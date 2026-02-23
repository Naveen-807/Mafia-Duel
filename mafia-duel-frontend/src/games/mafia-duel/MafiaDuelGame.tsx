import React, { useState, useEffect, useCallback } from 'react';
import { MafiaDuelService, PASS_TARGET } from './mafiaDuelService';
import type { Game, Slot } from './bindings';
import { useWallet } from '@/hooks/useWallet';
import { MAFIA_DUEL_CONTRACT } from '@/utils/constants';

// ── Role / Phase constants (must match contract) ──────────────────────────
const ROLE_MAFIA = 0;
const ROLE_VILLAGER = 1;
const ROLE_DOCTOR = 2;
const ROLE_SHERIFF = 3;

const ROLE_LABEL: Record<number, string> = {
  [ROLE_MAFIA]:    'Mafia 🔪',
  [ROLE_VILLAGER]: 'Villager 👤',
  [ROLE_DOCTOR]:   'Doctor 💊',
  [ROLE_SHERIFF]:  'Sheriff ⭐',
};

const PHASE_LOBBY = 0;
const PHASE_NIGHT = 1;
const PHASE_DAY   = 2;
const PHASE_OVER  = 3;

const TEAM_TOWN = 1;

// ── Props ─────────────────────────────────────────────────────────────────
interface MafiaDuelGameProps {
  userAddress: string;
  currentEpoch?: number;
  availablePoints?: bigint;
  onBack?: () => void;
  onStandingsRefresh?: () => void;
  onGameComplete?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function slotLabel(slot: Slot, idx: number) {
  if (!slot.addr) return `🤖 AI #${idx + 1}`;
  return shortAddr(slot.addr);
}

function mySlotIndex(game: Game, wallet: string): number {
  return game.slots.findIndex(s => s.addr === wallet);
}

// ── Main Component ────────────────────────────────────────────────────────
export function MafiaDuelGame({ userAddress, onBack, onGameComplete }: MafiaDuelGameProps) {
  const { getContractSigner } = useWallet();
  const service = React.useMemo(() => new MafiaDuelService(MAFIA_DUEL_CONTRACT), []);

  const [sessionId, setSessionId] = useState('');
  const [joinSessionId, setJoinSessionId] = useState('');
  const [wager, setWager] = useState('100');
  const [game, setGame] = useState<Game | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Polling ──────────────────────────────────────────────────────────────
  const poll = useCallback(async (sid: number) => {
    try {
      const g = await service.getGame(sid);
      if (g) setGame(g);
    } catch { /* ignore */ }
  }, [service]);

  useEffect(() => {
    if (!activeSessionId) return;
    poll(activeSessionId);
    const id = setInterval(() => poll(activeSessionId), 4000);
    return () => clearInterval(id);
  }, [activeSessionId, poll]);

  // When game ends, call onGameComplete callback
  useEffect(() => {
    if (game?.phase === PHASE_OVER && onGameComplete) {
      onGameComplete();
    }
  }, [game?.phase, onGameComplete]);

  // ── Action wrapper ────────────────────────────────────────────────────────
  async function run(label: string, fn: () => Promise<void>) {
    setError('');
    setLoading(true);
    setStatus(`${label}…`);
    try {
      await fn();
      setStatus(`${label} — done ✅`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleCreate() {
    const sid = parseInt(sessionId);
    if (!sid) return setError('Enter a valid session ID number');
    await run('Creating room', async () => {
      const signer = getContractSigner();
      await service.createGame(sid, userAddress, BigInt(wager), signer);
      setActiveSessionId(sid);
    });
  }

  async function handleJoin() {
    const sid = parseInt(joinSessionId);
    if (!sid) return setError('Enter a valid session ID number');
    await run('Joining room', async () => {
      const signer = getContractSigner();
      await service.joinGame(sid, userAddress, signer);
      setActiveSessionId(sid);
    });
  }

  async function handleBegin() {
    await run('Starting game', async () => {
      const signer = getContractSigner();
      await service.beginGame(activeSessionId!, userAddress, signer);
    });
  }

  async function handleSubmitAction(target: number) {
    await run('Submitting action', async () => {
      const signer = getContractSigner();
      await service.submitAction(activeSessionId!, userAddress, target, signer);
    });
  }

  async function handleResolve() {
    await run('Resolving phase', async () => {
      const signer = getContractSigner();
      await service.resolve(activeSessionId!, userAddress, signer);
    });
  }

  // ── Phase renderers ───────────────────────────────────────────────────────
  function renderLobby(g: Game) {
    const isCreator = g.creator === userAddress;
    return (
      <div>
        <h2 className="text-xl font-bold mb-2">🏠 Lobby — Session #{activeSessionId}</h2>
        <p className="text-sm text-gray-400 mb-4">Share this session ID with friends. Empty slots will be filled by AI when the game starts.</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {g.slots.map((s, i) => (
            <div key={i} className={`p-2 rounded border text-sm ${s.addr === userAddress ? 'border-yellow-400 bg-yellow-900/20' : 'border-gray-600 bg-gray-800'}`}>
              <span className="font-mono">{slotLabel(s, i)}</span>
              {s.addr === userAddress && <span className="ml-1 text-yellow-400 text-xs">(you)</span>}
            </div>
          ))}
        </div>
        {isCreator ? (
          <button onClick={handleBegin} disabled={loading} className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold disabled:opacity-50">
            ▶ Start Game
          </button>
        ) : (
          <p className="text-center text-gray-400 italic">Waiting for host to start the game…</p>
        )}
      </div>
    );
  }

  function renderNight(g: Game) {
    const myIdx = mySlotIndex(g, userAddress);
    if (myIdx === -1) return <p className="text-gray-400">You are not in this game.</p>;
    const me = g.slots[myIdx];
    const aliveSlots = g.slots.map((s, i) => ({ s, i })).filter(({ s }) => s.alive);

    return (
      <div>
        <h2 className="text-xl font-bold mb-1">🌙 Night {g.day}</h2>
        <p className="text-sm mb-3">Your role: <span className="font-bold">{ROLE_LABEL[me.role]}</span></p>

        {!me.alive && (
          <p className="text-gray-400 italic mb-4">You were eliminated. You can still call Resolve to advance the phase.</p>
        )}

        {me.alive && (
          me.submitted ? (
            <p className="text-green-400 mb-4">✅ Action submitted. Waiting for others…</p>
          ) : (
            <div className="mb-4">
              {me.role === ROLE_VILLAGER && (
                <div>
                  <p className="text-gray-300 mb-2">Villagers sleep through the night.</p>
                  <button onClick={() => handleSubmitAction(PASS_TARGET)} disabled={loading}
                    className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">
                    Pass (Sleep)
                  </button>
                </div>
              )}
              {me.role === ROLE_MAFIA && (
                <div>
                  <p className="text-gray-300 mb-2">Choose a Town player to eliminate:</p>
                  <div className="flex flex-col gap-2">
                    {aliveSlots.filter(({ s }) => s.role !== ROLE_MAFIA).map(({ s, i }) => (
                      <button key={i} onClick={() => handleSubmitAction(i)} disabled={loading}
                        className="py-1 px-3 bg-red-700 hover:bg-red-600 rounded text-sm disabled:opacity-50">
                        {slotLabel(s, i)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {me.role === ROLE_DOCTOR && (
                <div>
                  <p className="text-gray-300 mb-2">Choose a player to protect tonight:</p>
                  <div className="flex flex-col gap-2">
                    {aliveSlots.map(({ s, i }) => (
                      <button key={i} onClick={() => handleSubmitAction(i)} disabled={loading}
                        className="py-1 px-3 bg-green-700 hover:bg-green-600 rounded text-sm disabled:opacity-50">
                        {slotLabel(s, i)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {me.role === ROLE_SHERIFF && (
                <div>
                  <p className="text-gray-300 mb-2">Choose a player to investigate:</p>
                  <div className="flex flex-col gap-2">
                    {aliveSlots.filter(({ i }) => i !== myIdx).map(({ s, i }) => (
                      <button key={i} onClick={() => handleSubmitAction(i)} disabled={loading}
                        className="py-1 px-3 bg-blue-700 hover:bg-blue-600 rounded text-sm disabled:opacity-50">
                        {slotLabel(s, i)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        <hr className="border-gray-700 my-4" />
        <button onClick={handleResolve} disabled={loading} className="w-full py-2 bg-purple-700 hover:bg-purple-600 rounded font-semibold disabled:opacity-50">
          ⚡ Resolve Night
        </button>
        <p className="text-xs text-gray-500 mt-1">Anyone can call this once all humans have acted (or to skip).</p>

        {renderLastResult(g)}
      </div>
    );
  }

  function renderDay(g: Game) {
    const myIdx = mySlotIndex(g, userAddress);
    const me = myIdx !== -1 ? g.slots[myIdx] : null;
    const aliveSlots = g.slots.map((s, i) => ({ s, i })).filter(({ s }) => s.alive);

    return (
      <div>
        <h2 className="text-xl font-bold mb-1">☀️ Day {g.day} — Town Vote</h2>
        {me && !me.alive && <p className="text-gray-400 italic mb-2">You were eliminated.</p>}

        {me && me.alive && (
          me.submitted ? (
            <p className="text-green-400 mb-3">✅ Vote submitted. Waiting for others…</p>
          ) : (
            <div className="mb-3">
              <p className="text-gray-300 mb-2">Vote to eliminate a player:</p>
              <div className="flex flex-col gap-2">
                {aliveSlots.filter(({ i }) => i !== myIdx).map(({ s, i }) => (
                  <button key={i} onClick={() => handleSubmitAction(i)} disabled={loading}
                    className="py-1 px-3 bg-orange-700 hover:bg-orange-600 rounded text-sm disabled:opacity-50">
                    {slotLabel(s, i)}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        <hr className="border-gray-700 my-4" />
        <button onClick={handleResolve} disabled={loading} className="w-full py-2 bg-purple-700 hover:bg-purple-600 rounded font-semibold disabled:opacity-50">
          ⚡ Resolve Day Vote
        </button>

        {renderLastResult(g)}
      </div>
    );
  }

  function renderLastResult(g: Game) {
    const parts: string[] = [];
    if (g.last_killed !== undefined && g.last_killed !== null) {
      const who = slotLabel(g.slots[g.last_killed], g.last_killed);
      if (g.last_saved) {
        parts.push(`🛡 ${who} was attacked but the Doctor saved them!`);
      } else {
        parts.push(`💀 ${who} was eliminated by the Mafia.`);
      }
    }
    if (g.last_investigated !== undefined && g.last_investigated !== null) {
      const who = slotLabel(g.slots[g.last_investigated], g.last_investigated);
      const verdict = g.invest_is_mafia ? '⚠️ IS Mafia' : '✅ is Town';
      parts.push(`🔍 Sheriff investigated ${who}: ${verdict}`);
    }
    if (g.last_voted_out !== undefined && g.last_voted_out !== null) {
      const who = slotLabel(g.slots[g.last_voted_out], g.last_voted_out);
      const roleLabel = ROLE_LABEL[g.slots[g.last_voted_out].role];
      parts.push(`🗳 Town voted out ${who} — they were a ${roleLabel}!`);
    }
    if (!parts.length) return null;
    return (
      <div className="mt-4 p-3 bg-gray-800 rounded text-sm">
        <p className="font-semibold mb-1 text-gray-300">📜 Last Resolution:</p>
        {parts.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    );
  }

  function renderOver(g: Game) {
    const winnerLabel = g.winner === TEAM_TOWN ? 'Town 🏆' : 'Mafia 🔪';
    const winnerColor = g.winner === TEAM_TOWN ? 'text-green-400' : 'text-red-400';
    return (
      <div>
        <h2 className={`text-2xl font-bold mb-3 ${winnerColor}`}>Game Over — {winnerLabel} wins!</h2>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {g.slots.map((s, i) => (
            <div key={i} className={`p-2 rounded border text-sm ${s.role === ROLE_MAFIA ? 'border-red-500 bg-red-900/20' : 'border-gray-600 bg-gray-800'}`}>
              <div className="font-mono">{slotLabel(s, i)}{s.addr === userAddress ? ' (you)' : ''}</div>
              <div className="text-xs mt-0.5">{ROLE_LABEL[s.role]} — {s.alive ? '✅ alive' : '💀 dead'}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => { setGame(null); setActiveSessionId(null); setStatus(''); }}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded"
        >
          Play Again
        </button>
        {onBack && (
          <button onClick={onBack} className="w-full mt-2 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm">
            ← Back to Library
          </button>
        )}
      </div>
    );
  }

  // ── In-game rendering ──────────────────────────────────────────────────────
  if (game && activeSessionId !== null) {
    return (
      <div className="max-w-xl mx-auto p-4 text-white">
        <div className="flex justify-between items-center mb-3">
          {onBack && (
            <button onClick={onBack} className="text-sm text-gray-400 hover:text-white">
              ← Back
            </button>
          )}
          <span className="text-xs text-gray-500">Session #{activeSessionId}</span>
        </div>
        {status && <p className="text-sm text-blue-400 mb-2">{status}</p>}
        {error  && <p className="text-sm text-red-400 mb-2">❌ {error}</p>}
        {loading && <p className="text-xs text-gray-500 mb-2">Processing…</p>}
        {game.phase === PHASE_LOBBY && renderLobby(game)}
        {game.phase === PHASE_NIGHT && renderNight(game)}
        {game.phase === PHASE_DAY   && renderDay(game)}
        {game.phase === PHASE_OVER  && renderOver(game)}
      </div>
    );
  }

  // ── Home screen ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto p-4 text-white">
      <div className="flex items-center mb-6">
        {onBack && (
          <button onClick={onBack} className="mr-3 text-gray-400 hover:text-white text-sm">
            ← Back
          </button>
        )}
        <h1 className="text-2xl font-bold">🕵️ Mafia Duel</h1>
      </div>
      <p className="text-gray-400 text-sm mb-6 text-center">
        Up to 8 players — empty slots are filled by AI.<br/>
        Roles: 2 Mafia · 1 Doctor · 1 Sheriff · 4 Villager
      </p>

      {status && <p className="text-sm text-blue-400 mb-3">{status}</p>}
      {error  && <p className="text-sm text-red-400 mb-3">❌ {error}</p>}

      {/* Create */}
      <div className="bg-gray-800 p-4 rounded mb-4">
        <h2 className="font-semibold mb-3">Create a Room</h2>
        <input
          className="w-full bg-gray-700 p-2 rounded mb-2 text-sm"
          placeholder="Session ID (any number)"
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
        />
        <input
          className="w-full bg-gray-700 p-2 rounded mb-3 text-sm"
          placeholder="Wager (points)"
          value={wager}
          onChange={e => setWager(e.target.value)}
        />
        <button onClick={handleCreate} disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold disabled:opacity-50">
          {loading ? 'Creating…' : 'Create Room'}
        </button>
      </div>

      {/* Join */}
      <div className="bg-gray-800 p-4 rounded">
        <h2 className="font-semibold mb-3">Join a Room</h2>
        <input
          className="w-full bg-gray-700 p-2 rounded mb-3 text-sm"
          placeholder="Session ID from host"
          value={joinSessionId}
          onChange={e => setJoinSessionId(e.target.value)}
        />
        <button onClick={handleJoin} disabled={loading}
          className="w-full py-2 bg-green-600 hover:bg-green-700 rounded font-semibold disabled:opacity-50">
          {loading ? 'Joining…' : 'Join Room'}
        </button>
      </div>
    </div>
  );
}
