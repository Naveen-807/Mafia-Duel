import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MafiaDuelService, PASS_TARGET } from './mafiaDuelService';
import {
  zkCommit,
  getStoredCommitment,
  shortCommitment,
  targetLabel,
  type ZkCommitment,
} from './zkActionService';
import type { Game, Slot } from './bindings';
import { useWallet } from '@/hooks/useWallet';
import { MAFIA_DUEL_CONTRACT } from '@/utils/constants';

// --- UI Components ---
import { GameLayout } from './components/layout/GameLayout';
import { HomeScreen } from './components/screens/HomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { NightScreen } from './components/screens/NightScreen';
import { NightRevealScreen } from './components/screens/NightRevealScreen';
import { DayScreen } from './components/screens/DayScreen';
import { GameOverScreen } from './components/screens/GameOverScreen';
import { NeonCard } from './components/cards/NeonCard';
import { Badge } from './components/ui/Badge';

// ─── Constants (mirror contract exactly) ──────────────────────────────────
const ROLE_MAFIA = 0;
const ROLE_VILLAGER = 1;
const ROLE_DOCTOR = 2;
const ROLE_SHERIFF = 3;

const PHASE_LOBBY = 0;
const PHASE_NIGHT_COMMIT = 1;  // ZK: players submit sha256(target||nonce)
const PHASE_NIGHT_REVEAL = 2;  // ZK: players reveal; contract verifies onchain
const PHASE_DAY = 3;
const PHASE_OVER = 4;

const TEAM_TOWN = 1;
const TEAM_MAFIA = 0;

const ROLE_META = {
  [ROLE_MAFIA]: { icon: '🔪', label: 'Mafia', color: '#f87171', bg: 'rgba(220,38,38,0.18)', desc: 'Eliminate a Town player each night.' },
  [ROLE_VILLAGER]: { icon: '👤', label: 'Villager', color: '#94a3b8', bg: 'rgba(100,116,139,0.18)', desc: 'Villagers sleep — AI handles your pass automatically.' },
  [ROLE_DOCTOR]: { icon: '💊', label: 'Doctor', color: '#4ade80', bg: 'rgba(34,197,94,0.18)', desc: 'Protect one player from being killed each night.' },
  [ROLE_SHERIFF]: { icon: '⭐', label: 'Sheriff', color: '#facc15', bg: 'rgba(234,179,8,0.18)', desc: 'Investigate one player each night to reveal their team.' },
} as const;

// ─── Props ─────────────────────────────────────────────────────────────────
interface MafiaDuelGameProps {
  userAddress: string;
  currentEpoch?: number;
  availablePoints?: bigint;
  onBack?: () => void;
  onStandingsRefresh?: () => void;
  onGameComplete?: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function shortAddr(a: string) { return a.slice(0, 6) + '\u2026' + a.slice(-4); }
function slotName(sl: Slot, i: number) { return sl.addr ? shortAddr(sl.addr) : `AI Bot #${i + 1}`; }
function slotIcon(sl: Slot) { return sl.addr ? '🧑' : '🤖'; }
function parseError(e: unknown) { return e instanceof Error ? e.message : String(e); }
// Safely compare winner field (u32 from contract may be number or bigint)
function winnerIs(winner: number | bigint | undefined | null, team: number) {
  if (winner === undefined || winner === null) return false;
  return Number(winner) === team;
}

// ─── Styles ────────────────────────────────────────────────────────────────
const C = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg,#090912 0%,#110a18 60%,#080f0c 100%)', color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif" } as React.CSSProperties,
  wrap: { maxWidth: 560, margin: '0 auto', padding: '20px 16px' } as React.CSSProperties,
  card: (glow = '#7c3aed'): React.CSSProperties => ({ background: 'rgba(12,12,22,0.95)', border: `1px solid ${glow}44`, borderRadius: 16, padding: 20, marginBottom: 14, boxShadow: `0 0 24px ${glow}22, inset 0 1px 0 rgba(255,255,255,0.04)` }),
  input: { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 13px', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 8 },
  label: { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#475569', marginBottom: 5 },
  btn: (bg: string): React.CSSProperties => ({ width: '100%', padding: '12px 18px', borderRadius: 11, border: 'none', background: bg, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 6, letterSpacing: 0.3 }),
  btnRow: (bg: string): React.CSSProperties => ({ padding: '9px 14px', borderRadius: 9, border: 'none', background: bg, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left' as const, marginBottom: 6 }),
  badge: (color: string, bg: string): React.CSSProperties => ({ background: bg, border: `1px solid ${color}`, color, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' as const }),
  alert: (err: boolean): React.CSSProperties => ({ padding: '9px 13px', borderRadius: 9, background: err ? 'rgba(220,38,38,0.13)' : 'rgba(99,102,241,0.13)', border: `1px solid ${err ? 'rgba(220,38,38,0.35)' : 'rgba(99,102,241,0.35)'}`, color: err ? '#fca5a5' : '#a5b4fc', fontSize: 13, marginBottom: 10 }),
  divider: { border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0' } as React.CSSProperties,
  slot: (me: boolean, alive: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 9, background: me ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.025)', border: `1px solid ${me ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)'}`, opacity: alive ? 1 : 0.4 }),
};

// ─── Main Component ────────────────────────────────────────────────────────
export function MafiaDuelGame({ userAddress, onBack, onGameComplete }: MafiaDuelGameProps) {
  const { getContractSigner, switchPlayer, getCurrentDevPlayer, walletType } = useWallet();
  const service = React.useMemo(() => new MafiaDuelService(MAFIA_DUEL_CONTRACT), []);

  // Home screen form state
  const [createSid, setCreateSid] = useState('');
  const [joinSid, setJoinSid] = useState('');
  const [wager, setWager] = useState('100');

  // Game state
  const [game, setGame] = useState<Game | null>(null);
  const [sid, setSid] = useState<number | null>(null);

  // UI state
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Track previous userAddress to detect wallet switch
  const prevAddr = useRef(userAddress);
  // Track (sid, phase, day) triple to avoid double auto-pass
  const autoPassKey = useRef('');

  // ── ZK commitment state ─────────────────────────────────────────────────
  // Holds the most recent ZK commitment generated by this player this phase.
  const [zkProof, setZkProof] = useState<ZkCommitment | null>(null);

  // Reset ZK proof state when a new night commit phase starts
  useEffect(() => { if (game?.phase === PHASE_NIGHT_COMMIT) setZkProof(null); }, [game?.phase, game?.day]);

  // ── Wallet switch: stay in game if new wallet is a participant ───────────
  useEffect(() => {
    if (prevAddr.current === userAddress) return;
    prevAddr.current = userAddress;
    const alreadyInGame = game !== null && game.slots.some(sl => sl.addr === userAddress);
    if (alreadyInGame) {
      setStatus('');
      setError('');
    } else {
      setGame(null);
      setSid(null);
      setStatus('');
      setError('');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  // ── Polling ─────────────────────────────────────────────────────────────
  const poll = useCallback(async (s: number) => {
    try {
      const g = await service.getGame(s);
      if (g) setGame(g);
    } catch { /* ignore poll errors */ }
  }, [service]);

  useEffect(() => {
    if (!sid) return;
    poll(sid);
    const id = setInterval(() => poll(sid), 3500);
    return () => clearInterval(id);
  }, [sid, poll]);

  // Trigger onGameComplete callback
  useEffect(() => {
    if (game?.phase === PHASE_OVER && onGameComplete) onGameComplete();
  }, [game?.phase, onGameComplete]);

  // ── Auto-commit for Villager at PHASE_NIGHT_COMMIT ────────────────────
  // Villagers have no night action — auto-commit sha256(PASS_TARGET, 0n)
  useEffect(() => {
    if (!game || !sid || game.phase !== PHASE_NIGHT_COMMIT) return;
    const myIdx = game.slots.findIndex(sl => sl.addr === userAddress);
    if (myIdx === -1) return;
    const me = game.slots[myIdx];
    if (!me.alive || me.submitted || me.role !== ROLE_VILLAGER) return;

    const key = `${sid}-commit-${game.day}`;
    if (autoPassKey.current === key) return;
    autoPassKey.current = key;

    (async () => {
      try {
        const sg = getContractSigner();
        // Villager always commits PASS_TARGET with nonce=0 (deterministic, no secret needed)
        const proof = await zkCommit(PASS_TARGET, sid, game.day, PHASE_NIGHT_COMMIT);
        setZkProof(proof);
        await service.submitCommitment(sid, userAddress, proof.commitment, sg);
        await poll(sid);
      } catch (e) {
        const msg = parseError(e);
        if (!msg.includes('#6') && !msg.toLowerCase().includes('alreadyacted')) {
          setError('Auto-commit failed: ' + msg);
        } else {
          await poll(sid);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.day, sid, userAddress]);

  // ── Auto-reveal for Villager at PHASE_NIGHT_REVEAL ────────────────────
  // After committing, auto-reveal the PASS_TARGET using the stored nonce
  useEffect(() => {
    if (!game || !sid || game.phase !== PHASE_NIGHT_REVEAL) return;
    const myIdx = game.slots.findIndex(sl => sl.addr === userAddress);
    if (myIdx === -1) return;
    const me = game.slots[myIdx];
    if (!me.alive || me.submitted || me.role !== ROLE_VILLAGER) return;

    const key = `${sid}-reveal-${game.day}`;
    if (autoPassKey.current === key) return;
    autoPassKey.current = key;

    (async () => {
      try {
        // Look up the commitment stored during the commit phase
        const stored = getStoredCommitment(sid, game.day, PHASE_NIGHT_COMMIT);
        if (!stored) {
          setError('No stored commitment for reveal — please refresh.');
          return;
        }
        const sg = getContractSigner();
        await service.revealAction(sid, userAddress, stored.target, stored.nonce, sg);
        await poll(sid);
      } catch (e) {
        const msg = parseError(e);
        if (!msg.includes('#6') && !msg.toLowerCase().includes('alreadyacted')) {
          setError('Auto-reveal failed: ' + msg);
        } else {
          await poll(sid);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.day, sid, userAddress]);

  // ── Generic action runner ────────────────────────────────────────────────
  async function run(label: string, fn: () => Promise<void>) {
    setError('');
    setLoading(true);
    setStatus(label + '\u2026');
    try {
      await fn();
      setStatus(label + ' \u2705');
      if (sid) poll(sid);
    } catch (e: unknown) {
      const msg = parseError(e);
      if (msg.includes('#6') || msg.toLowerCase().includes('alreadyacted')) {
        setStatus('Already submitted \u2014 waiting for others\u2026');
        if (sid) poll(sid);
      } else if (msg.includes('#9') || msg.toLowerCase().includes('gamealreadyover')) {
        setStatus('Game already over \u2014 refreshing\u2026');
        if (sid) poll(sid);
      } else {
        setError(msg);
        setStatus('');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleCreate() {
    const id = parseInt(createSid);
    if (!id || isNaN(id)) return setError('Enter a valid session ID number');
    setError(''); setLoading(true); setStatus('Creating room\u2026');
    try {
      const sg = getContractSigner();
      await service.createGame(id, userAddress, BigInt(wager || '0'), sg);
      setSid(id);
      await poll(id);
      setStatus('Room created \u2705 \u2014 share session ID ' + id);
    } catch (e) {
      const msg = parseError(e);
      if (msg.includes('#11') || msg.toLowerCase().includes('sessionexists')) {
        setSid(id);
        await poll(id);
        setStatus('Session exists \u2014 connected \u2705');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    const id = parseInt(joinSid);
    if (!id || isNaN(id)) return setError('Enter a valid session ID number');
    setError(''); setLoading(true); setStatus('Looking up game\u2026');
    try {
      const existing = await service.getGame(id);
      if (!existing) { setError('No game found with session ID ' + id); return; }

      const alreadyIn = existing.slots.some(sl => sl.addr === userAddress);
      if (alreadyIn) {
        setGame(existing); setSid(id); setStatus('Reconnected \u2705');
        return;
      }
      if (existing.phase !== PHASE_LOBBY) {
        setError('This game has already started \u2014 you cannot join.');
        return;
      }
      const sg = getContractSigner();
      await service.joinGame(id, userAddress, sg);
      setSid(id);
      await poll(id);
      setStatus('Joined \u2705');
    } catch (e) {
      const msg = parseError(e);
      if (msg.includes('#3') || msg.toLowerCase().includes('alreadyjoined')) {
        setSid(id); await poll(id); setStatus('Already in game \u2014 reconnected \u2705');
      } else if (msg.includes('#5') || msg.toLowerCase().includes('wrongphase')) {
        setError('This game has already started \u2014 you cannot join.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLobbyJoin() {
    if (!sid) return;
    await run('Joining game', async () => {
      const sg = getContractSigner();
      await service.joinGame(sid, userAddress, sg);
    });
  }

  async function handleBegin() {
    await run('Starting game', async () => {
      const sg = getContractSigner();
      await service.beginGame(sid!, userAddress, sg);
    });
  }

  // ── Night Commit: generate SHA-256 commitment and submit onchain ─────────
  async function handleNightCommit(target: number) {
    if (!game || sid === null) return;
    await run('Committing action (ZK)', async () => {
      // Compute sha256(target_u32_be || nonce_u64_be) — matches contract exactly
      const proof = await zkCommit(target, sid, game.day, PHASE_NIGHT_COMMIT);
      setZkProof(proof);
      const sg = getContractSigner();
      // Submit ONLY the hash onchain — target is hidden until reveal
      await service.submitCommitment(sid, userAddress, proof.commitment, sg);
    });
  }

  // ── Night Reveal: prove commitment onchain; contract verifies sha256 ──────
  async function handleNightReveal() {
    if (!game || sid === null) return;
    // Retrieve the target + nonce from localStorage (stored during commit phase)
    const stored = getStoredCommitment(sid, game.day, PHASE_NIGHT_COMMIT);
    if (!stored) {
      setError('No commitment found for this round — cannot reveal.');
      return;
    }
    await run('Revealing action (ZK verified onchain)', async () => {
      const sg = getContractSigner();
      // Contract recomputes sha256(target||nonce) and rejects if it doesn't match
      await service.revealAction(sid, userAddress, stored.target, stored.nonce, sg);
    });
  }

  // ── Day Vote: transparent (daytime discussion is public by design) ─────────
  async function handleDayAction(target: number) {
    await run('Casting vote', async () => {
      const sg = getContractSigner();
      await service.submitAction(sid!, userAddress, target, sg);
    });
  }

  // Legacy alias used in a couple of places
  const handleAction = handleDayAction;

  async function handleResolve() {
    await run('Resolving phase', async () => {
      const sg = getContractSigner();
      await service.resolve(sid!, userAddress, sg);
    });
  }

  async function handleSwitchWallet(p: 1 | 2) {
    if (walletType !== 'dev') return;
    setLoading(true);
    try { await switchPlayer(p); } catch (e) { setError(parseError(e)); }
    finally { setLoading(false); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const myIdx = game ? game.slots.findIndex(sl => sl.addr === userAddress) : -1;
  const me = myIdx !== -1 && game ? game.slots[myIdx] : null;
  const inGame = myIdx !== -1;
  const curPlayer = walletType === 'dev' ? getCurrentDevPlayer() : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Shared sub-components (no state — safe to define inline)
  // ─────────────────────────────────────────────────────────────────────────

  function WalletBar() {
    if (walletType !== 'dev') return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
        <span style={{ color: '#475569' }}>
          {shortAddr(userAddress)}&nbsp;<span style={{ color: '#7c3aed' }}>({curPlayer === 1 ? 'Player 1' : 'Player 2'})</span>
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {([1, 2] as const).map(p => (
            <button key={p} onClick={() => handleSwitchWallet(p)} style={{ padding: '3px 9px', borderRadius: 6, border: 'none', background: curPlayer === p ? '#7c3aed' : 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>P{p}</button>
          ))}
        </div>
      </div>
    );
  }

  function PageHeader({ phase }: { phase: number }) {
    const labels: Record<number, string> = {
      [PHASE_LOBBY]: '🏠 Lobby',
      [PHASE_NIGHT_COMMIT]: '🌙 Night — Commit',
      [PHASE_NIGHT_REVEAL]: '🔓 Night — Reveal',
      [PHASE_DAY]: '☀️ Day',
      [PHASE_OVER]: '🏁 Game Over',
    };
    const isNightOrDay = phase === PHASE_NIGHT_COMMIT || phase === PHASE_NIGHT_REVEAL || phase === PHASE_DAY;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            {labels[phase] ?? `Phase ${phase}`}
            {isNightOrDay && ` — Round ${game?.day ?? ''}`}
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>Session #{sid}</div>
        </div>
        {onBack && (
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 11px', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
            ← Back
          </button>
        )}
      </div>
    );
  }

  function Alerts() {
    return (
      <>
        {status && !error && <div style={C.alert(false)}>\u26a1 {status}</div>}
        {error && (
          <div style={C.alert(true)}>
            \u26a0 {error}
            <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>\u2715</button>
          </div>
        )}
        {loading && <div style={C.alert(false)}>\u231b Processing\u2026</div>}
      </>
    );
  }

  // Show submitted checkmark on player grid during active phases
  function SlotGrid({ showRole, showSubmitted }: { showRole?: boolean; showSubmitted?: boolean }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {game!.slots.map((sl, i) => {
          const rm = showRole ? ROLE_META[sl.role as keyof typeof ROLE_META] : null;
          const isMe = sl.addr === userAddress;
          return (
            <div key={i} style={C.slot(isMe, sl.alive)}>
              <span style={{ fontSize: 15 }}>{slotIcon(sl)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {slotName(sl, i)}
                </div>
                <div style={{ fontSize: 10, marginTop: 1, color: sl.alive ? '#4ade80' : '#ef4444' }}>
                  {showRole && rm
                    ? `${rm.icon} ${rm.label}`
                    : showSubmitted && sl.alive
                      ? (sl.submitted ? '\u2705 ready' : '\u23f3 thinking\u2026')
                      : (sl.alive ? '\u25cf alive' : '\u2715 out')}
                </div>
              </div>
              {isMe && <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', letterSpacing: 1 }}>YOU</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── ZK Proof Panel ─────────────────────────────────────────────────────
  // Shows the SHA-256 onchain commitment and the reveal status.
  function ZkProofPanel({ proof, slotNames }: { proof: ZkCommitment; slotNames: string[] }) {
    const tLabel = targetLabel(proof.target, slotNames);
    return (
      <div style={{ background: 'rgba(0,255,150,0.05)', border: '1px solid rgba(0,255,150,0.2)', borderRadius: 10, padding: '11px 14px', marginTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#34d399', marginBottom: 8 }}>
          🔐 ZK Commitment (SHA-256 · Onchain Verified)
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6ee7b7', wordBreak: 'break-all', marginBottom: 8 }}>
          {shortCommitment(proof.commitment)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
          <span>Committed to: <b style={{ color: '#e2e8f0' }}>{tLabel}</b></span>
          <span style={{ color: '#34d399', fontWeight: 700 }}>⛓ Binding onchain</span>
        </div>
        <div style={{ fontSize: 10, color: '#334155', marginTop: 6, lineHeight: 1.6 }}>
          sha256({proof.target === 4294967295 ? 'PASS' : `slot #${proof.target}`}_be32 ‖ nonce_be64) = {shortCommitment(proof.commitment)}
          &nbsp;— contract will reject any different reveal.
        </div>
      </div>
    );
  }

  // Last-event summary — shown at start of each new phase
  // Sheriff investigation result is ONLY shown to the Sheriff (game secrecy)
  function LastEvent() {
    if (!game) return null;
    const isSheriff = me?.role === ROLE_SHERIFF;
    const lines: { icon: string; text: string }[] = [];

    // Who was killed last night (visible to all)
    if (game.last_killed != null) {
      const killed = game.slots[game.last_killed as number];
      if (killed) {
        lines.push(game.last_saved
          ? { icon: '🛡️', text: `${slotName(killed, game.last_killed as number)} was attacked — Doctor saved them!` }
          : { icon: '💀', text: `${slotName(killed, game.last_killed as number)} was eliminated by the Mafia.` }
        );
      }
    }

    // Who was voted out in day (visible to all, role revealed)
    if (game.last_voted_out != null) {
      const voted = game.slots[game.last_voted_out as number];
      if (voted) {
        const rm2 = ROLE_META[voted.role as keyof typeof ROLE_META];
        lines.push({ icon: '🗳️', text: `Town voted out ${slotName(voted, game.last_voted_out as number)} — they were ${rm2.icon} ${rm2.label}!` });
      }
    }

    // Investigation result — ONLY visible to the Sheriff
    if (isSheriff && game.last_investigated != null) {
      const investigated = game.slots[game.last_investigated as number];
      if (investigated) {
        lines.push({
          icon: '🔍',
          text: `[Sheriff] You investigated ${slotName(investigated, game.last_investigated as number)}: ${game.invest_is_mafia ? '\u26a0\ufe0f IS Mafia!' : '\u2705 Town member.'}`,
        });
      }
    }

    // ZK reveal summary — shown after day resolve (start of next night commit)
    if (game.phase === PHASE_NIGHT_COMMIT && game.day > 1) {
      const prevRound = game.day - 1;
      const storedProof = getStoredCommitment(sid!, prevRound, PHASE_NIGHT_COMMIT);
      if (storedProof) {
        const slotNames = game.slots.map((sl, i) => slotName(sl, i));
        lines.push({
          icon: '🔐',
          text: `Your ZK commitment from last night was for "${targetLabel(storedProof.target, slotNames)}" — sha256 verified onchain ✅`,
        });
      }
    }

    if (!lines.length) return null;
    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#475569', marginBottom: 9 }}>Last Resolution</div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: i < lines.length - 1 ? 7 : 0 }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{l.icon}</span>
            <span style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{l.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // Count of players who still need to submit (human only, alive, not yet submitted)
  function pendingCount(g: Game) {
    return g.slots.filter(sl => sl.addr != null && sl.alive && !sl.submitted).length;
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  const renderScreen = () => {
    if (!game || sid === null) {
      return (
        <HomeScreen
          createSid={createSid}
          setCreateSid={setCreateSid}
          wager={wager}
          setWager={setWager}
          joinSid={joinSid}
          setJoinSid={setJoinSid}
          loading={loading}
          onCreate={handleCreate}
          onJoin={handleJoin}
        />
      );
    }

    if (game.phase === PHASE_LOBBY) {
      return (
        <LobbyScreen
          game={game}
          sid={sid}
          userAddress={userAddress}
          loading={loading}
          onJoin={handleLobbyJoin}
          onStart={handleBegin}
          onLeave={() => { setGame(null); setSid(null); setStatus(''); setError(''); }}
        />
      );
    }

    if (game.phase === PHASE_OVER) {
      return (
        <GameOverScreen
          game={game}
          userAddress={userAddress}
          onPlayAgain={() => { setGame(null); setSid(null); setStatus(''); setError(''); autoPassKey.current = ''; }}
          slotName={slotName}
          slotIcon={slotIcon}
          TEAM_TOWN={TEAM_TOWN}
        />
      );
    }

    // ── NIGHT COMMIT PHASE ────────────────────────────────────────────────────
    if (game.phase === PHASE_NIGHT_COMMIT) {
      return (
        <NightScreen
          game={game}
          sid={sid}
          me={me}
          myIdx={myIdx}
          inGame={inGame}
          loading={loading}
          pendingCount={pendingCount(game)}
          zkProof={zkProof}
          slotName={slotName}
          slotIcon={slotIcon}
          onAction={handleNightCommit}
          onResolve={handleResolve}
          lastEventPanel={<LastEvent />}
          zkProofPanel={zkProof ? <ZkProofPanel proof={zkProof} slotNames={game.slots.map((sl, i) => slotName(sl, i))} /> : null}
        />
      );
    }

    // ── NIGHT REVEAL PHASE ────────────────────────────────────────────────────
    if (game.phase === PHASE_NIGHT_REVEAL) {
      const stored = sid !== null ? getStoredCommitment(sid, game.day, PHASE_NIGHT_COMMIT) : null;
      return (
        <NightRevealScreen
          game={game}
          sid={sid}
          me={me}
          inGame={inGame}
          loading={loading}
          pendingCount={pendingCount(game)}
          zkProof={zkProof}
          storedTargetLabel={stored ? targetLabel(stored.target, game.slots.map((sl, i) => slotName(sl, i))) : ''}
          onReveal={handleNightReveal}
          onResolve={handleResolve}
          zkProofPanel={zkProof ? <ZkProofPanel proof={zkProof} slotNames={game.slots.map((sl, i) => slotName(sl, i))} /> : null}
        />
      );
    }

    // ── DAY PHASE ─────────────────────────────────────────────────────────────
    if (game.phase === PHASE_DAY) {
      return (
        <DayScreen
          game={game}
          sid={sid}
          me={me}
          myIdx={myIdx}
          inGame={inGame}
          loading={loading}
          pendingCount={pendingCount(game)}
          zkProof={zkProof}
          slotName={slotName}
          slotIcon={slotIcon}
          onAction={handleDayAction}
          onResolve={handleResolve}
          lastEventPanel={<LastEvent />}
          zkProofPanel={zkProof ? <ZkProofPanel proof={zkProof} slotNames={game.slots.map((sl, i) => slotName(sl, i))} /> : null}
          PASS_TARGET={PASS_TARGET}
        />
      );
    }

    return null;
  };

  const getPhaseString = () => {
    if (!game || sid === null) return undefined;
    if (game.phase === PHASE_LOBBY) return 'lobby';
    if (game.phase === PHASE_NIGHT_COMMIT || game.phase === PHASE_NIGHT_REVEAL) return 'night';
    if (game.phase === PHASE_DAY) return 'day';
    if (game.phase === PHASE_OVER) return 'over';
    return undefined;
  };

  return (
    <GameLayout phase={getPhaseString() as any}>
      <WalletBar />
      {game && sid !== null && <PageHeader phase={game.phase} />}
      <Alerts />
      {renderScreen()}
    </GameLayout>
  );
}
