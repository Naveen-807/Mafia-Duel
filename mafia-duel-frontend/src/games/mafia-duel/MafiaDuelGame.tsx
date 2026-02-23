import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MafiaDuelService, PASS_TARGET } from './mafiaDuelService';
import type { Game, Slot } from './bindings';
import { useWallet } from '@/hooks/useWallet';
import { MAFIA_DUEL_CONTRACT } from '@/utils/constants';

// ─── Constants (mirror contract exactly) ──────────────────────────────────
const ROLE_MAFIA    = 0;
const ROLE_VILLAGER = 1;
const ROLE_DOCTOR   = 2;
const ROLE_SHERIFF  = 3;

const PHASE_LOBBY   = 0;
const PHASE_NIGHT   = 1;
const PHASE_DAY     = 2;
const PHASE_OVER    = 3;

const TEAM_TOWN  = 1;
const TEAM_MAFIA = 0;

const ROLE_META = {
  [ROLE_MAFIA]:    { icon: '🔪', label: 'Mafia',    color: '#f87171', bg: 'rgba(220,38,38,0.18)',   desc: 'Eliminate a Town player each night.' },
  [ROLE_VILLAGER]: { icon: '👤', label: 'Villager', color: '#94a3b8', bg: 'rgba(100,116,139,0.18)', desc: 'Villagers sleep — AI handles your pass automatically.' },
  [ROLE_DOCTOR]:   { icon: '💊', label: 'Doctor',   color: '#4ade80', bg: 'rgba(34,197,94,0.18)',   desc: 'Protect one player from being killed each night.' },
  [ROLE_SHERIFF]:  { icon: '⭐', label: 'Sheriff',  color: '#facc15', bg: 'rgba(234,179,8,0.18)',   desc: 'Investigate one player each night to reveal their team.' },
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
  page:    { minHeight: '100vh', background: 'linear-gradient(135deg,#090912 0%,#110a18 60%,#080f0c 100%)', color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif" } as React.CSSProperties,
  wrap:    { maxWidth: 560, margin: '0 auto', padding: '20px 16px' } as React.CSSProperties,
  card:    (glow = '#7c3aed'): React.CSSProperties => ({ background: 'rgba(12,12,22,0.95)', border: `1px solid ${glow}44`, borderRadius: 16, padding: 20, marginBottom: 14, boxShadow: `0 0 24px ${glow}22, inset 0 1px 0 rgba(255,255,255,0.04)` }),
  input:   { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 13px', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 8 },
  label:   { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#475569', marginBottom: 5 },
  btn:     (bg: string): React.CSSProperties => ({ width: '100%', padding: '12px 18px', borderRadius: 11, border: 'none', background: bg, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 6, letterSpacing: 0.3 }),
  btnRow:  (bg: string): React.CSSProperties => ({ padding: '9px 14px', borderRadius: 9, border: 'none', background: bg, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left' as const, marginBottom: 6 }),
  badge:   (color: string, bg: string): React.CSSProperties => ({ background: bg, border: `1px solid ${color}`, color, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' as const }),
  alert:   (err: boolean): React.CSSProperties => ({ padding: '9px 13px', borderRadius: 9, background: err ? 'rgba(220,38,38,0.13)' : 'rgba(99,102,241,0.13)', border: `1px solid ${err ? 'rgba(220,38,38,0.35)' : 'rgba(99,102,241,0.35)'}`, color: err ? '#fca5a5' : '#a5b4fc', fontSize: 13, marginBottom: 10 }),
  divider: { border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0' } as React.CSSProperties,
  slot:    (me: boolean, alive: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 9, background: me ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.025)', border: `1px solid ${me ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)'}`, opacity: alive ? 1 : 0.4 }),
};

// ─── Main Component ────────────────────────────────────────────────────────
export function MafiaDuelGame({ userAddress, onBack, onGameComplete }: MafiaDuelGameProps) {
  const { getContractSigner, switchPlayer, getCurrentDevPlayer, walletType } = useWallet();
  const service = React.useMemo(() => new MafiaDuelService(MAFIA_DUEL_CONTRACT), []);

  // Home screen form state
  const [createSid, setCreateSid] = useState('');
  const [joinSid,   setJoinSid]   = useState('');
  const [wager,     setWager]     = useState('100');

  // Game state
  const [game, setGame] = useState<Game | null>(null);
  const [sid,  setSid]  = useState<number | null>(null);

  // UI state
  const [status,  setStatus]  = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Track previous userAddress to detect wallet switch
  const prevAddr    = useRef(userAddress);
  // Track (sid, phase, day) triple to avoid double auto-pass
  const autoPassKey = useRef('');

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

  // ── Auto-pass for Villager at Night ────────────────────────────────────
  // Villagers have no night action; auto-submit their PASS when night starts
  useEffect(() => {
    if (!game || !sid || game.phase !== PHASE_NIGHT) return;
    const myIdx = game.slots.findIndex(sl => sl.addr === userAddress);
    if (myIdx === -1) return;
    const me = game.slots[myIdx];
    if (!me.alive || me.submitted || me.role !== ROLE_VILLAGER) return;

    // Use a key so we only auto-pass once per (sid, phase, day) — avoid loops
    const key = `${sid}-night-${game.day}`;
    if (autoPassKey.current === key) return;
    autoPassKey.current = key;

    (async () => {
      try {
        const sg = getContractSigner();
        await service.submitAction(sid, userAddress, PASS_TARGET, sg);
        await poll(sid);
      } catch (e) {
        const msg = parseError(e);
        // AlreadyActed (#6) means we already submitted — just refresh
        if (!msg.includes('#6') && !msg.toLowerCase().includes('alreadyacted')) {
          setError('Auto-pass failed: ' + msg);
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

  async function handleAction(target: number) {
    await run('Submitting action', async () => {
      const sg = getContractSigner();
      await service.submitAction(sid!, userAddress, target, sg);
    });
  }

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
  const myIdx   = game ? game.slots.findIndex(sl => sl.addr === userAddress) : -1;
  const me      = myIdx !== -1 && game ? game.slots[myIdx] : null;
  const inGame  = myIdx !== -1;
  const curPlayer = walletType === 'dev' ? getCurrentDevPlayer() : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Shared sub-components (no state — safe to define inline)
  // ─────────────────────────────────────────────────────────────────────────

  function WalletBar() {
    if (walletType !== 'dev') return null;
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 12px', marginBottom:12, fontSize:12 }}>
        <span style={{ color:'#475569' }}>
          {shortAddr(userAddress)}&nbsp;<span style={{ color:'#7c3aed' }}>({curPlayer === 1 ? 'Player 1' : 'Player 2'})</span>
        </span>
        <div style={{ display:'flex', gap:6 }}>
          {([1, 2] as const).map(p => (
            <button key={p} onClick={() => handleSwitchWallet(p)} style={{ padding:'3px 9px', borderRadius:6, border:'none', background: curPlayer === p ? '#7c3aed' : 'rgba(255,255,255,0.07)', color:'#fff', fontSize:11, cursor:'pointer', fontWeight:600 }}>P{p}</button>
          ))}
        </div>
      </div>
    );
  }

  function PageHeader({ phase }: { phase: number }) {
    const labels = ['🏠 Lobby', '🌙 Night', '\u2600\ufe0f Day', '🏁 Game Over'];
    return (
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:17 }}>
            {labels[phase]}
            {(phase === PHASE_NIGHT || phase === PHASE_DAY) && ` \u2014 Round ${game?.day ?? ''}`}
          </div>
          <div style={{ fontSize:11, color:'#475569' }}>Session #{sid}</div>
        </div>
        {onBack && (
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'5px 11px', color:'#94a3b8', fontSize:11, cursor:'pointer' }}>
            \u2190 Back
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
            <button onClick={() => setError('')} style={{ float:'right', background:'none', border:'none', color:'#fca5a5', cursor:'pointer', fontSize:12 }}>\u2715</button>
          </div>
        )}
        {loading && <div style={C.alert(false)}>\u231b Processing\u2026</div>}
      </>
    );
  }

  // Show submitted checkmark on player grid during active phases
  function SlotGrid({ showRole, showSubmitted }: { showRole?: boolean; showSubmitted?: boolean }) {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
        {game!.slots.map((sl, i) => {
          const rm = showRole ? ROLE_META[sl.role as keyof typeof ROLE_META] : null;
          const isMe = sl.addr === userAddress;
          return (
            <div key={i} style={C.slot(isMe, sl.alive)}>
              <span style={{ fontSize:15 }}>{slotIcon(sl)}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {slotName(sl, i)}
                </div>
                <div style={{ fontSize:10, marginTop:1, color: sl.alive ? '#4ade80' : '#ef4444' }}>
                  {showRole && rm
                    ? `${rm.icon} ${rm.label}`
                    : showSubmitted && sl.alive
                      ? (sl.submitted ? '\u2705 ready' : '\u23f3 thinking\u2026')
                      : (sl.alive ? '\u25cf alive' : '\u2715 out')}
                </div>
              </div>
              {isMe && <span style={{ fontSize:9, fontWeight:800, color:'#7c3aed', letterSpacing:1 }}>YOU</span>}
            </div>
          );
        })}
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

    if (!lines.length) return null;
    return (
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:11, padding:'12px 14px', marginBottom:12 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#475569', marginBottom:9 }}>Last Resolution</div>
        {lines.map((l, i) => (
          <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start', marginBottom: i < lines.length - 1 ? 7 : 0 }}>
            <span style={{ fontSize:15, flexShrink:0 }}>{l.icon}</span>
            <span style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.5 }}>{l.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // Count of players who still need to submit (human only, alive, not yet submitted)
  function pendingCount(g: Game) {
    return g.slots.filter(sl => sl.addr != null && sl.alive && !sl.submitted).length;
  }

  // ── HOME SCREEN ───────────────────────────────────────────────────────────
  if (!game || sid === null) {
    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <div style={{ textAlign:'center', padding:'28px 0 20px' }}>
            <div style={{ fontSize:56, marginBottom:6 }}>🕵️</div>
            <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:'-0.5px', background:'linear-gradient(90deg,#f87171,#c084fc)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:0 }}>
              Mafia Duel
            </h1>
            <p style={{ fontSize:13, color:'#475569', marginTop:8, lineHeight:1.7 }}>
              8 players \u00b7 AI fills empty seats<br/>
              <span style={{ color:'#f87171' }}>2 Mafia</span> \u00b7 <span style={{ color:'#4ade80' }}>1 Doctor</span> \u00b7 <span style={{ color:'#facc15' }}>1 Sheriff</span> \u00b7 <span style={{ color:'#64748b' }}>4 Villager</span>
            </p>
          </div>

          <Alerts />

          <div style={C.card('#7c3aed')}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              <span>🏠</span> Create a Room
            </div>
            <label style={C.label}>Session ID (any number)</label>
            <input style={C.input} placeholder="e.g. 42069" value={createSid} onChange={e => setCreateSid(e.target.value)} />
            <label style={C.label}>Wager (points)</label>
            <input style={C.input} placeholder="100" value={wager} onChange={e => setWager(e.target.value)} />
            <button style={C.btn('linear-gradient(135deg,#7c3aed,#4f46e5)')} disabled={loading} onClick={handleCreate}>
              {loading ? '\u231b Creating\u2026' : '+ Create Room'}
            </button>
          </div>

          <div style={C.card('#16a34a')}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              <span>🚪</span> Join a Room
            </div>
            <label style={C.label}>Session ID from host</label>
            <input style={C.input} placeholder="Paste session ID here" value={joinSid} onChange={e => setJoinSid(e.target.value)} />
            <button style={C.btn('linear-gradient(135deg,#16a34a,#15803d)')} disabled={loading} onClick={handleJoin}>
              {loading ? '\u231b Joining\u2026' : '\u2192 Join Room'}
            </button>
          </div>

          <div style={C.card('#0f172a')}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'#64748b' }}>HOW TO PLAY (DEV)</div>
            <div style={{ fontSize:12, color:'#475569', lineHeight:1.9 }}>
              1. <b style={{ color:'#94a3b8' }}>P1</b> creates a room with any session ID.<br/>
              2. Click <b style={{ color:'#94a3b8' }}>P2</b> button \u2192 P2 enters same ID \u2192 Join.<br/>
              3. Switch back to <b style={{ color:'#94a3b8' }}>P1</b> \u2192 click <b style={{ color:'#94a3b8' }}>Start Game</b>.<br/>
              4. Villagers auto-pass each night \u2014 no action needed.<br/>
              5. Other roles pick targets; then click <b style={{ color:'#94a3b8' }}>Resolve</b>.<br/>
              6. Day: everyone votes; click <b style={{ color:'#94a3b8' }}>Resolve Day Vote</b>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (game.phase === PHASE_LOBBY) {
    const isCreator = game.creator === userAddress;
    // Fix: use != null (catches both null and undefined) for Option<string>
    const humanCount = game.slots.filter(sl => sl.addr != null).length;
    const alreadyJoined = game.slots.some(sl => sl.addr === userAddress);
    const canJoin = !alreadyJoined;
    const isFull = game.human_count >= 8;

    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <PageHeader phase={PHASE_LOBBY} />
          <Alerts />

          <div style={C.card()}>
            <div style={{ background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:9, padding:'10px 13px', marginBottom:16, fontSize:13, display:'flex', alignItems:'center', gap:10 }}>
              <span>📋</span>
              <span>Share <b style={{ color:'#a78bfa' }}>Session #{sid}</b> so others can join. Empty slots will be AI bots.</span>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={C.label}>{humanCount} / 8 players joined</div>
              <SlotGrid />
            </div>

            {canJoin && !isFull && (
              <button style={C.btn('linear-gradient(135deg,#16a34a,#15803d)')} disabled={loading} onClick={handleLobbyJoin}>
                {loading ? '\u231b Joining\u2026' : '🚪 Join This Game'}
              </button>
            )}
            {canJoin && isFull && (
              <div style={{ textAlign:'center', color:'#64748b', fontStyle:'italic', padding:'10px 0' }}>Room is full.</div>
            )}
            {isCreator && (
              <button style={C.btn('linear-gradient(135deg,#7c3aed,#be185d)')} disabled={loading} onClick={handleBegin}>
                {loading ? '\u231b Starting\u2026' : '\u25b6 Start Game'}
              </button>
            )}
            {alreadyJoined && !isCreator && (
              <div style={{ textAlign:'center', color:'#475569', fontStyle:'italic', padding:'10px 0', fontSize:13 }}>
                \u23f3 Waiting for host to start the game\u2026
              </div>
            )}
          </div>

          <button
            style={{ ...C.btn('rgba(255,255,255,0.04)'), fontSize:12, color:'#475569', padding:'8px 14px' }}
            onClick={() => { setGame(null); setSid(null); setStatus(''); setError(''); }}
          >
            \u2190 Leave Room
          </button>
        </div>
      </div>
    );
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (game.phase === PHASE_OVER) {
    const townWon = winnerIs(game.winner, TEAM_TOWN);
    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <PageHeader phase={PHASE_OVER} />

          <div style={{ ...C.card(townWon ? '#4ade80' : '#f87171'), textAlign:'center', padding:28 }}>
            <div style={{ fontSize:52, marginBottom:8 }}>{townWon ? '🏆' : '😈'}</div>
            <div style={{ fontSize:24, fontWeight:900, color: townWon ? '#4ade80' : '#f87171' }}>
              {townWon ? 'Town Wins!' : 'Mafia Wins!'}
            </div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>
              {townWon ? 'Justice prevailed — all Mafia eliminated.' : 'The Mafia seized control of the town.'}
            </div>
          </div>

          <div style={C.card()}>
            <div style={C.label}>Full Role Reveal</div>
            {game.slots.map((sl, i) => {
              const rm = ROLE_META[sl.role as keyof typeof ROLE_META];
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:15 }}>{slotIcon(sl)}</span>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:600, fontSize:12 }}>{slotName(sl, i)}</span>
                    {sl.addr === userAddress && <span style={{ marginLeft:6, ...C.badge('#7c3aed', 'rgba(124,58,237,0.15)') }}>YOU</span>}
                  </div>
                  <span style={C.badge(rm.color, rm.bg)}>{rm.icon} {rm.label}</span>
                  <span style={{ fontSize:11, color: sl.alive ? '#4ade80' : '#ef4444' }}>{sl.alive ? '\u2713' : '\u2715'}</span>
                </div>
              );
            })}
          </div>

          <button
            style={C.btn('rgba(255,255,255,0.06)')}
            onClick={() => { setGame(null); setSid(null); setStatus(''); setError(''); autoPassKey.current = ''; }}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ── NIGHT PHASE ───────────────────────────────────────────────────────────
  if (game.phase === PHASE_NIGHT) {
    const alive     = game.slots.map((sl, i) => ({ sl, i })).filter(x => x.sl.alive);
    // Mafia kills ONLY living Town players (non-Mafia)
    const townAlive = alive.filter(x => x.sl.role !== ROLE_MAFIA);
    const rm        = me ? ROLE_META[me.role as keyof typeof ROLE_META] : null;
    const pending   = pendingCount(game);

    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <PageHeader phase={PHASE_NIGHT} />
          <Alerts />
          <LastEvent />

          {/* Role identity card */}
          {me && rm && (
            <div style={{ ...C.card(rm.color), marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                <div style={{ width:48, height:48, borderRadius:12, background:rm.bg, border:`2px solid ${rm.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                  {rm.icon}
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:17, color:rm.color }}>{rm.label}</div>
                  <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{rm.desc}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action panel */}
          <div style={C.card()}>
            {!inGame ? (
              <div style={{ color:'#475569', textAlign:'center', padding:'8px 0', fontStyle:'italic', fontSize:13 }}>
                👁 You are spectating this game.
              </div>
            ) : !me?.alive ? (
              <div style={{ color:'#64748b', textAlign:'center', padding:'8px 0', fontStyle:'italic', fontSize:13 }}>
                💀 Eliminated — you watch in silence.
              </div>
            ) : me?.submitted ? (
              <div style={{ textAlign:'center', padding:'10px 0' }}>
                <div style={{ fontSize:26, marginBottom:5 }}>✅</div>
                <div style={{ fontWeight:700, color:'#4ade80', fontSize:15 }}>Action submitted!</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>
                  {pending > 0 ? `Waiting for ${pending} more player${pending > 1 ? 's' : ''}\u2026` : 'All done \u2014 resolve when ready.'}
                </div>
              </div>
            ) : me?.role === ROLE_VILLAGER ? (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:26, marginBottom:5 }}>😴</div>
                <div style={{ fontWeight:600, color:'#94a3b8', fontSize:14 }}>Auto-passing for you\u2026</div>
                <div style={{ fontSize:12, color:'#475569', marginTop:4 }}>Villagers sleep through the night.</div>
              </div>
            ) : (
              <>
                {me.role === ROLE_MAFIA && (
                  <>
                    <div style={{ color:'#f87171', fontWeight:600, fontSize:13, marginBottom:12 }}>🔪 Kill — choose your target:</div>
                    {townAlive.length === 0
                      ? <div style={{ color:'#475569', fontSize:12 }}>No Town players alive.</div>
                      : townAlive.map(({ sl, i }) => (
                          <button key={i} style={C.btnRow('rgba(220,38,38,0.2)')} disabled={loading} onClick={() => handleAction(i)}>
                            {slotIcon(sl)} {slotName(sl, i)}
                          </button>
                        ))
                    }
                  </>
                )}
                {me.role === ROLE_DOCTOR && (
                  <>
                    <div style={{ color:'#4ade80', fontWeight:600, fontSize:13, marginBottom:12 }}>💊 Protect — choose who to save tonight:</div>
                    {alive.map(({ sl, i }) => (
                      <button key={i} style={C.btnRow('rgba(34,197,94,0.18)')} disabled={loading} onClick={() => handleAction(i)}>
                        {slotIcon(sl)} {slotName(sl, i)}
                      </button>
                    ))}
                  </>
                )}
                {me.role === ROLE_SHERIFF && (
                  <>
                    <div style={{ color:'#facc15', fontWeight:600, fontSize:13, marginBottom:12 }}>⭐ Investigate — reveal a player&apos;s alignment:</div>
                    {alive.filter(({ i }) => i !== myIdx).map(({ sl, i }) => (
                      <button key={i} style={C.btnRow('rgba(234,179,8,0.18)')} disabled={loading} onClick={() => handleAction(i)}>
                        {slotIcon(sl)} {slotName(sl, i)}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}

            <hr style={C.divider} />
            <div style={{ fontSize:12, color:'#475569', marginBottom:9 }}>
              {pending > 0
                ? `${pending} human${pending > 1 ? 's' : ''} yet to act. You can still resolve early:`
                : 'All humans ready \u2014 resolve now:'}
            </div>
            <button style={C.btn('linear-gradient(135deg,#5b21b6,#3730a3)')} disabled={loading} onClick={handleResolve}>
              {loading ? '\u231b Resolving\u2026' : '\u26a1 Resolve Night'}
            </button>
          </div>

          <div style={C.card()}>
            <div style={C.label}>{game.slots.filter(s => s.alive).length} players alive</div>
            <SlotGrid showSubmitted />
          </div>
        </div>
      </div>
    );
  }

  // ── DAY PHASE ─────────────────────────────────────────────────────────────
  if (game.phase === PHASE_DAY) {
    const alive   = game.slots.map((sl, i) => ({ sl, i })).filter(x => x.sl.alive);
    const pending = pendingCount(game);

    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <PageHeader phase={PHASE_DAY} />
          <Alerts />
          <LastEvent />

          <div style={C.card('#b45309')}>
            {!inGame ? (
              <div style={{ color:'#475569', textAlign:'center', padding:'8px 0', fontStyle:'italic', fontSize:13 }}>
                👁 You are spectating this game.
              </div>
            ) : !me?.alive ? (
              <div style={{ color:'#64748b', textAlign:'center', padding:'8px 0', fontStyle:'italic', fontSize:13 }}>
                💀 Eliminated — you watch the vote.
              </div>
            ) : me?.submitted ? (
              <div style={{ textAlign:'center', padding:'10px 0' }}>
                <div style={{ fontSize:26, marginBottom:5 }}>✅</div>
                <div style={{ fontWeight:700, color:'#4ade80', fontSize:15 }}>Vote cast!</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>
                  {pending > 0 ? `Waiting for ${pending} more player${pending > 1 ? 's' : ''}\u2026` : 'All done \u2014 resolve when ready.'}
                </div>
              </div>
            ) : (
              <>
                <div style={{ color:'#fde68a', fontWeight:600, fontSize:13, marginBottom:12 }}>🗳️ Vote to eliminate a suspect:</div>
                {alive.filter(({ i }) => i !== myIdx).map(({ sl, i }) => (
                  <button key={i} style={C.btnRow('rgba(180,83,9,0.25)')} disabled={loading} onClick={() => handleAction(i)}>
                    {slotIcon(sl)} {slotName(sl, i)}
                  </button>
                ))}
                <button style={{ ...C.btnRow('rgba(100,116,139,0.18)'), color:'#94a3b8', fontStyle:'italic' }} disabled={loading} onClick={() => handleAction(PASS_TARGET)}>
                  🤷 Abstain (no vote)
                </button>
              </>
            )}

            <hr style={C.divider} />
            <div style={{ fontSize:12, color:'#475569', marginBottom:9 }}>
              {pending > 0
                ? `${pending} human${pending > 1 ? 's' : ''} yet to vote. Resolve early or wait:`
                : 'All votes in \u2014 resolve now:'}
            </div>
            <button style={C.btn('linear-gradient(135deg,#92400e,#78350f)')} disabled={loading} onClick={handleResolve}>
              {loading ? '\u231b Resolving\u2026' : '\u26a1 Resolve Day Vote'}
            </button>
          </div>

          <div style={C.card()}>
            <div style={C.label}>{game.slots.filter(s => s.alive).length} players alive</div>
            <SlotGrid showSubmitted />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
