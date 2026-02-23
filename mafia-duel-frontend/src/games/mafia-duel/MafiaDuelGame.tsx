
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MafiaDuelService, PASS_TARGET } from './mafiaDuelService';
import type { Game, Slot } from './bindings';
import { useWallet } from '@/hooks/useWallet';
import { MAFIA_DUEL_CONTRACT } from '@/utils/constants';

// ─── Constants (must mirror contract) ─────────────────────────────────────
const ROLE_MAFIA    = 0;
const ROLE_VILLAGER = 1;
const ROLE_DOCTOR   = 2;
const ROLE_SHERIFF  = 3;
const PHASE_LOBBY   = 0;
const PHASE_NIGHT   = 1;
const PHASE_DAY     = 2;
const PHASE_OVER    = 3;
const TEAM_TOWN     = 1;

const ROLE_META = {
  [ROLE_MAFIA]:    { icon: '🔪', label: 'Mafia',    color: '#f87171', bg: 'rgba(220,38,38,0.18)',   desc: 'Eliminate a Town player each night.' },
  [ROLE_VILLAGER]: { icon: '👤', label: 'Villager', color: '#94a3b8', bg: 'rgba(100,116,139,0.18)', desc: 'Vote out Mafia members during the day.' },
  [ROLE_DOCTOR]:   { icon: '💊', label: 'Doctor',   color: '#4ade80', bg: 'rgba(34,197,94,0.18)',   desc: 'Protect one player from being killed each night.' },
  [ROLE_SHERIFF]:  { icon: '⭐', label: 'Sheriff',  color: '#facc15', bg: 'rgba(234,179,8,0.18)',   desc: 'Investigate one player each night.' },
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
function shortAddr(addr: string) { return addr.slice(0, 6) + '…' + addr.slice(-4); }
function slotName(sl: Slot, i: number) { return sl.addr ? shortAddr(sl.addr) : `AI Bot #${i + 1}`; }
function slotIcon(sl: Slot) { return sl.addr ? '🧑' : '🤖'; }
function parseError(e: unknown) { return e instanceof Error ? e.message : String(e); }
function isErrCode(msg: string, ...codes: number[]) {
  return codes.some(c => msg.includes(`#${c}`) || msg.includes(Object.keys({
    AlreadyActed: 6, WrongPhase: 5, AlreadyJoined: 3, NotInGame: 4,
    GameAlreadyOver: 9, NotCreator: 10, SessionExists: 11
  }).find((_, idx) => idx + 1 === c) || ''));
}

// ─── Styles ────────────────────────────────────────────────────────────────
const C = {
  page:    { minHeight: '100vh', background: 'linear-gradient(135deg,#090912 0%,#110a18 60%,#080f0c 100%)', color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif" } as React.CSSProperties,
  wrap:    { maxWidth: 560, margin: '0 auto', padding: '20px 16px' } as React.CSSProperties,
  card:    (glow = '#7c3aed'): React.CSSProperties => ({ background: 'rgba(12,12,22,0.95)', border: `1px solid ${glow}44`, borderRadius: 16, padding: 20, marginBottom: 14, boxShadow: `0 0 24px ${glow}22, inset 0 1px 0 rgba(255,255,255,0.04)` }),
  input:   { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 13px', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 8 },
  label:   { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#475569', marginBottom: 5 },
  btn:     (bg: string): React.CSSProperties => ({ width: '100%', padding: '12px 18px', borderRadius: 11, border: 'none', background: bg, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 6, letterSpacing: 0.3 }),
  btnRow:  (bg: string): React.CSSProperties => ({ padding: '9px 14px', borderRadius: 9, border: 'none', background: bg, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left' as const }),
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
  const [createSid,  setCreateSid]  = useState('');
  const [joinSid,    setJoinSid]    = useState('');
  const [wager,      setWager]      = useState('100');

  // Game state
  const [game,    setGame]    = useState<Game | null>(null);
  const [sid,     setSid]     = useState<number | null>(null);

  // UI state
  const [status,  setStatus]  = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Track previous userAddress to detect wallet switch
  const prevAddr = useRef(userAddress);

  // ── When wallet switches, reset to home screen ──────────────────────────
  useEffect(() => {
    if (prevAddr.current !== userAddress) {
      prevAddr.current = userAddress;
      // Reset game state so new wallet sees home / join screen
      setGame(null);
      setSid(null);
      setStatus('');
      setError('');
      setLoading(false);
    }
  }, [userAddress]);

  // ── Polling ─────────────────────────────────────────────────────────────
  const poll = useCallback(async (s: number) => {
    try {
      const g = await service.getGame(s);
      if (g) setGame(g);
    } catch {}
  }, [service]);

  useEffect(() => {
    if (!sid) return;
    poll(sid);
    const id = setInterval(() => poll(sid), 3500);
    return () => clearInterval(id);
  }, [sid, poll]);

  useEffect(() => {
    if (game?.phase === PHASE_OVER && onGameComplete) onGameComplete();
  }, [game?.phase, onGameComplete]);

  // ── Generic action runner ────────────────────────────────────────────────
  async function run(label: string, fn: () => Promise<void>) {
    setError(''); setLoading(true); setStatus(label + '…');
    try {
      await fn();
      setStatus(label + ' ✅');
      if (sid) poll(sid); // refresh immediately after action
    } catch (e: unknown) {
      const msg = parseError(e);
      // Error #6 AlreadyActed — already submitted, just refresh
      if (msg.includes('#6') || msg.toLowerCase().includes('alreadyacted')) {
        setStatus('Already submitted — waiting for others…');
        if (sid) poll(sid);
      }
      // Error #9 GameAlreadyOver
      else if (msg.includes('#9') || msg.toLowerCase().includes('gamealreadyover')) {
        setStatus('Game already over — refreshing…');
        if (sid) poll(sid);
      }
      else {
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
    setError(''); setLoading(true); setStatus('Creating room…');
    try {
      const sg = getContractSigner();
      await service.createGame(id, userAddress, BigInt(wager || '0'), sg);
      setSid(id);
      await poll(id); // load immediately
      setStatus('Room created ✅ — you can share session ID ' + id);
    } catch (e) {
      const msg = parseError(e);
      if (msg.includes('#11') || msg.toLowerCase().includes('sessionexists')) {
        // Session already exists — just join it
        setSid(id);
        await poll(id);
        setStatus('Session already exists — connected ✅');
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
    setError(''); setLoading(true); setStatus('Looking up game…');
    try {
      const existing = await service.getGame(id);
      if (!existing) {
        setError('No game found with session ID ' + id);
        setLoading(false);
        return;
      }
      const alreadyIn = existing.slots.some(sl => sl.addr === userAddress);
      if (alreadyIn) {
        // Reconnect — user already in the game
        setGame(existing);
        setSid(id);
        setStatus('Reconnected ✅');
        setLoading(false);
        return;
      }
      if (existing.phase !== PHASE_LOBBY) {
        setError('This game has already started — you cannot join mid-game.');
        setLoading(false);
        return;
      }
      const sg = getContractSigner();
      await service.joinGame(id, userAddress, sg);
      setSid(id);
      await poll(id);
      setStatus('Joined room ✅');
    } catch (e) {
      const msg = parseError(e);
      if (msg.includes('#3') || msg.toLowerCase().includes('alreadyjoined')) {
        setSid(id);
        await poll(id);
        setStatus('Already in this game — reconnected ✅');
      } else if (msg.includes('#5') || msg.toLowerCase().includes('wrongphase')) {
        setError('This game has already started — you cannot join mid-game.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // Join directly from the lobby card (for users who switched wallet after creator joined)
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

  // Dev wallet switch (only in dev mode)
  async function handleSwitchWallet(p: 1 | 2) {
    if (walletType !== 'dev') return;
    setLoading(true);
    try { await switchPlayer(p); } catch (e) { setError(parseError(e)); }
    finally { setLoading(false); }
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const myIdx  = game ? game.slots.findIndex(sl => sl.addr === userAddress) : -1;
  const me     = myIdx !== -1 && game ? game.slots[myIdx] : null;
  const inGame = myIdx !== -1;
  const curPlayer = walletType === 'dev' ? getCurrentDevPlayer() : null;

  // ── Shared UI pieces ─────────────────────────────────────────────────────
  const WalletBar = () => (
    walletType === 'dev' ? (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 12px', marginBottom:12, fontSize:12 }}>
        <span style={{ color:'#475569' }}>
          {shortAddr(userAddress)} <span style={{ color:'#7c3aed' }}>({curPlayer === 1 ? 'Player 1' : 'Player 2'})</span>
        </span>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => handleSwitchWallet(1)} style={{ padding:'3px 9px', borderRadius:6, border:'none', background: curPlayer===1 ? '#7c3aed' : 'rgba(255,255,255,0.07)', color:'#fff', fontSize:11, cursor:'pointer', fontWeight:600 }}>P1</button>
          <button onClick={() => handleSwitchWallet(2)} style={{ padding:'3px 9px', borderRadius:6, border:'none', background: curPlayer===2 ? '#7c3aed' : 'rgba(255,255,255,0.07)', color:'#fff', fontSize:11, cursor:'pointer', fontWeight:600 }}>P2</button>
        </div>
      </div>
    ) : null
  );

  const PageHeader = ({ phase }: { phase: number }) => {
    const labels = ['🏠 Lobby', '🌙 Night', '☀️ Day', '🏁 Game Over'];
    return (
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:17 }}>{labels[phase]}{phase===PHASE_NIGHT||phase===PHASE_DAY ? ` — Round ${game?.day ?? ''}` : ''}</div>
          <div style={{ fontSize:11, color:'#475569' }}>Session #{sid}</div>
        </div>
        {onBack && <button onClick={onBack} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'5px 11px', color:'#94a3b8', fontSize:11, cursor:'pointer' }}>← Back</button>}
      </div>
    );
  };

  const Alerts = () => (
    <>
      {status && !error && <div style={C.alert(false)}>⚡ {status}</div>}
      {error && <div style={C.alert(true)}>⚠ {error} <button onClick={()=>setError('')} style={{ float:'right', background:'none', border:'none', color:'#fca5a5', cursor:'pointer', fontSize:12 }}>✕</button></div>}
      {loading && <div style={C.alert(false)}>⏳ Processing…</div>}
    </>
  );

  const SlotGrid = ({ showRole }: { showRole?: boolean }) => (
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
              <div style={{ fontSize:10, color: sl.alive ? '#4ade80' : '#ef4444', marginTop:1 }}>
                {showRole && rm ? `${rm.icon} ${rm.label}` : (sl.alive ? '● alive' : '✕ out')}
              </div>
            </div>
            {isMe && <span style={{ fontSize:9, fontWeight:800, color:'#7c3aed', letterSpacing:1 }}>YOU</span>}
          </div>
        );
      })}
    </div>
  );

  const LastEvent = () => {
    if (!game) return null;
    const lines: { icon: string; text: string }[] = [];
    if (game.last_killed != null) {
      const sl = game.slots[game.last_killed];
      const who = slotName(sl, game.last_killed);
      lines.push(game.last_saved
        ? { icon: '🛡', text: `${who} was attacked — Doctor saved them!` }
        : { icon: '💀', text: `${who} was eliminated by the Mafia.` });
    }
    if (game.last_investigated != null) {
      const sl = game.slots[game.last_investigated];
      lines.push({ icon: '🔍', text: `Sheriff investigated ${slotName(sl, game.last_investigated)}: ${game.invest_is_mafia ? '⚠️ IS Mafia!' : '✅ Town member.'}` });
    }
    if (game.last_voted_out != null) {
      const sl = game.slots[game.last_voted_out];
      const rm = ROLE_META[sl.role as keyof typeof ROLE_META];
      lines.push({ icon: '🗳', text: `Town voted out ${slotName(sl, game.last_voted_out)} — they were ${rm.icon} ${rm.label}!` });
    }
    if (!lines.length) return null;
    return (
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:11, padding:'12px 14px', marginBottom:12 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'#475569', marginBottom:9 }}>Last Resolution</div>
        {lines.map((l, i) => (
          <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start', marginBottom: i < lines.length-1 ? 7 : 0 }}>
            <span style={{ fontSize:15, flexShrink:0 }}>{l.icon}</span>
            <span style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.5 }}>{l.text}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── HOME SCREEN ───────────────────────────────────────────────────────────
  if (!game || sid === null) {
    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          {/* Hero */}
          <div style={{ textAlign:'center', padding:'28px 0 20px' }}>
            <div style={{ fontSize:56, marginBottom:6 }}>🕵️</div>
            <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:'-0.5px', background:'linear-gradient(90deg,#f87171,#c084fc)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:0 }}>
              Mafia Duel
            </h1>
            <p style={{ fontSize:13, color:'#475569', marginTop:8, lineHeight:1.7 }}>
              8 players · AI fills empty seats<br/>
              <span style={{ color:'#f87171' }}>2 Mafia</span> · <span style={{ color:'#4ade80' }}>1 Doctor</span> · <span style={{ color:'#facc15' }}>1 Sheriff</span> · <span style={{ color:'#64748b' }}>4 Villager</span>
            </p>
          </div>

          <Alerts />

          {/* Create room */}
          <div style={C.card('#7c3aed')}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>🏠</span> Create a Room
            </div>
            <label style={C.label}>Session ID (pick any number)</label>
            <input style={C.input} placeholder="e.g. 42069" value={createSid} onChange={e => setCreateSid(e.target.value)} />
            <label style={C.label}>Wager (points)</label>
            <input style={C.input} placeholder="100" value={wager} onChange={e => setWager(e.target.value)} />
            <button style={C.btn('linear-gradient(135deg,#7c3aed,#4f46e5)')} disabled={loading} onClick={handleCreate}>
              {loading ? '⏳ Creating…' : '+ Create Room'}
            </button>
          </div>

          {/* Join room */}
          <div style={C.card('#16a34a')}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>🚪</span> Join a Room
            </div>
            <label style={C.label}>Session ID from host</label>
            <input style={C.input} placeholder="Paste session ID here" value={joinSid} onChange={e => setJoinSid(e.target.value)} />
            <button style={C.btn('linear-gradient(135deg,#16a34a,#15803d)')} disabled={loading} onClick={handleJoin}>
              {loading ? '⏳ Joining…' : '→ Join Room'}
            </button>
          </div>

          {/* How to play */}
          <div style={C.card('#0f172a')}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'#64748b' }}>HOW TO PLAY (DEV)</div>
            <div style={{ fontSize:12, color:'#475569', lineHeight:1.8 }}>
              1. <b style={{ color:'#94a3b8' }}>Player 1</b> creates a room with any session ID.<br/>
              2. Switch to <b style={{ color:'#94a3b8' }}>Player 2</b> using P1/P2 buttons above.<br/>
              3. Player 2 enters the same session ID and clicks Join.<br/>
              4. Switch back to Player 1 and click <b style={{ color:'#94a3b8' }}>Start Game</b>.<br/>
              5. Each player takes their night/day actions in turn.<br/>
              6. Click <b style={{ color:'#94a3b8' }}>Resolve</b> to advance each phase.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (game.phase === PHASE_LOBBY) {
    const isCreator = game.creator === userAddress;
    const humanSlots = game.slots.filter(sl => sl.addr !== null);
    const joinedAddresses = game.slots.map(sl => sl.addr).filter(Boolean);
    const alreadyJoined = joinedAddresses.includes(userAddress);
    const canJoin = !alreadyJoined && !isCreator;
    const isFull = game.human_count >= 8;

    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <PageHeader phase={PHASE_LOBBY} />
          <Alerts />

          <div style={C.card()}>
            {/* Share banner */}
            <div style={{ background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:9, padding:'10px 13px', marginBottom:16, fontSize:13, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18 }}>📋</span>
              <span>Share <b style={{ color:'#a78bfa' }}>Session #{sid}</b> so others can join. Empty slots will be AI.</span>
            </div>

            {/* Slot grid */}
            <div style={{ marginBottom:16 }}>
              <div style={C.label}>{humanSlots.length} / 8 players joined</div>
              <SlotGrid />
            </div>

            {/* Actions */}
            {canJoin && !isFull && (
              <button style={C.btn('linear-gradient(135deg,#16a34a,#15803d)')} disabled={loading} onClick={handleLobbyJoin}>
                {loading ? '⏳ Joining…' : '🚪 Join This Game'}
              </button>
            )}
            {isFull && !alreadyJoined && (
              <div style={{ textAlign:'center', color:'#64748b', fontStyle:'italic', padding:'10px 0' }}>Room is full.</div>
            )}
            {isCreator && (
              <button style={C.btn('linear-gradient(135deg,#7c3aed,#be185d)')} disabled={loading} onClick={handleBegin}>
                {loading ? '⏳ Starting…' : '▶ Start Game'}
              </button>
            )}
            {alreadyJoined && !isCreator && (
              <div style={{ textAlign:'center', color:'#475569', fontStyle:'italic', padding:'10px 0', fontSize:13 }}>
                ⏳ Waiting for host to start the game…
              </div>
            )}
          </div>

          <button style={{ ...C.btn('rgba(255,255,255,0.04)'), fontSize:12, color:'#475569', padding:'8px 14px' }} onClick={() => { setGame(null); setSid(null); setStatus(''); setError(''); }}>
            ← Leave Room
          </button>
        </div>
      </div>
    );
  }

  // ── GAME OVER ──────────────────────────────────────────────────────────────
  if (game.phase === PHASE_OVER) {
    const townWon = game.winner === TEAM_TOWN;
    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <PageHeader phase={PHASE_OVER} />

          {/* Winner banner */}
          <div style={{ ...C.card(townWon ? '#4ade80' : '#f87171'), textAlign:'center', padding:28 }}>
            <div style={{ fontSize:52, marginBottom:8 }}>{townWon ? '🏆' : '😈'}</div>
            <div style={{ fontSize:24, fontWeight:900, color: townWon ? '#4ade80' : '#f87171' }}>
              {townWon ? 'Town Wins!' : 'Mafia Wins!'}
            </div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>
              {townWon ? 'Justice prevailed — all Mafia eliminated.' : 'The Mafia seized control of the town.'}
            </div>
          </div>

          {/* Full reveal */}
          <div style={C.card()}>
            <div style={C.label}>Full Role Reveal</div>
            {game.slots.map((sl, i) => {
              const rm = ROLE_META[sl.role as keyof typeof ROLE_META];
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:15 }}>{slotIcon(sl)}</span>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:600, fontSize:12 }}>{slotName(sl, i)}</span>
                    {sl.addr === userAddress && <span style={{ marginLeft:6, ...C.badge('#7c3aed','rgba(124,58,237,0.15)') }}>YOU</span>}
                  </div>
                  <span style={C.badge(rm.color, rm.bg)}>{rm.icon} {rm.label}</span>
                  <span style={{ fontSize:11, color: sl.alive ? '#4ade80' : '#ef4444' }}>{sl.alive ? '✓' : '✕'}</span>
                </div>
              );
            })}
          </div>

          <button style={C.btn('rgba(255,255,255,0.06)')} onClick={() => { setGame(null); setSid(null); setStatus(''); setError(''); }}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ── NIGHT PHASE ────────────────────────────────────────────────────────────
  if (game.phase === PHASE_NIGHT) {
    const alive = game.slots.map((sl, i) => ({ sl, i })).filter(x => x.sl.alive);
    const townAlive = alive.filter(x => x.sl.role !== ROLE_MAFIA);
    const rm = me ? ROLE_META[me.role as keyof typeof ROLE_META] : null;

    return (
      <div style={C.page}>
        <div style={C.wrap}>
          <WalletBar />
          <PageHeader phase={PHASE_NIGHT} />
          <Alerts />
          <LastEvent />

          {/* Role card */}
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
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>Waiting for other players…</div>
              </div>
            ) : (
              <>
                {me.role === ROLE_VILLAGER && (
                  <>
                    <div style={{ color:'#94a3b8', fontSize:13, marginBottom:13 }}>Villagers sleep through the night — no action needed.</div>
                    <button style={C.btn('rgba(100,116,139,0.25)')} disabled={loading} onClick={() => handleAction(PASS_TARGET)}>
                      😴 Sleep (Pass)
                    </button>
                  </>
                )}
                {me.role === ROLE_MAFIA && (
                  <>
                    <div style={{ color:'#f87171', fontWeight:600, fontSize:13, marginBottom:12 }}>🔪 Kill — choose your target:</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {townAlive.map(({ sl, i }) => (
                        <button key={i} style={C.btnRow('rgba(220,38,38,0.2)')} disabled={loading} onClick={() => handleAction(i)}>
                          <span style={{ marginRight:9 }}>{slotIcon(sl)}</span>{slotName(sl, i)}
                        </button>
                      ))}
                      {townAlive.length === 0 && <div style={{ color:'#475569', fontSize:12 }}>No Town players alive.</div>}
                    </div>
                  </>
                )}
                {me.role === ROLE_DOCTOR && (
                  <>
                    <div style={{ color:'#4ade80', fontWeight:600, fontSize:13, marginBottom:12 }}>💊 Protect — choose who to save tonight:</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {alive.map(({ sl, i }) => (
                        <button key={i} style={C.btnRow('rgba(34,197,94,0.18)')} disabled={loading} onClick={() => handleAction(i)}>
                          <span style={{ marginRight:9 }}>{slotIcon(sl)}</span>{slotName(sl, i)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {me.role === ROLE_SHERIFF && (
                  <>
                    <div style={{ color:'#facc15', fontWeight:600, fontSize:13, marginBottom:12 }}>⭐ Investigate — reveal a player's alignment:</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {alive.filter(({ i }) => i !== myIdx).map(({ sl, i }) => (
                        <button key={i} style={C.btnRow('rgba(234,179,8,0.18)')} disabled={loading} onClick={() => handleAction(i)}>
                          <span style={{ marginRight:9 }}>{slotIcon(sl)}</span>{slotName(sl, i)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <hr style={C.divider} />
            <div style={{ fontSize:12, color:'#475569', marginBottom:9 }}>
              Once all humans have acted (or to force-skip), anyone can resolve:
            </div>
            <button style={C.btn('linear-gradient(135deg,#5b21b6,#3730a3)')} disabled={loading} onClick={handleResolve}>
              {loading ? '⏳ Resolving…' : '⚡ Resolve Night'}
            </button>
          </div>

          {/* Player grid */}
          <div style={C.card()}>
            <div style={C.label}>{game.slots.filter(s => s.alive).length} players alive</div>
            <SlotGrid />
          </div>
        </div>
      </div>
    );
  }

  // ── DAY PHASE ──────────────────────────────────────────────────────────────
  if (game.phase === PHASE_DAY) {
    const alive = game.slots.map((sl, i) => ({ sl, i })).filter(x => x.sl.alive);

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
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>Waiting for other votes…</div>
              </div>
            ) : (
              <>
                <div style={{ color:'#fde68a', fontWeight:600, fontSize:13, marginBottom:12 }}>🗳 Vote to eliminate a player:</div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {alive.filter(({ i }) => i !== myIdx).map(({ sl, i }) => (
                    <button key={i} style={C.btnRow('rgba(180,83,9,0.25)')} disabled={loading} onClick={() => handleAction(i)}>
                      <span style={{ marginRight:9 }}>{slotIcon(sl)}</span>{slotName(sl, i)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <hr style={C.divider} />
            <div style={{ fontSize:12, color:'#475569', marginBottom:9 }}>Advance the vote:</div>
            <button style={C.btn('linear-gradient(135deg,#92400e,#78350f)')} disabled={loading} onClick={handleResolve}>
              {loading ? '⏳ Resolving…' : '⚡ Resolve Day Vote'}
            </button>
          </div>

          <div style={C.card()}>
            <div style={C.label}>{game.slots.filter(s => s.alive).length} players alive</div>
            <SlotGrid />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
