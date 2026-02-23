import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoleCard, NeonCard } from '../cards/NeonCard';
import { ActionButton, NeonButton } from '../ui/NeonButton';
import { Badge } from '../ui/Badge';
import { staggerContainer, staggerChild, cardVariants, roleCardVariants } from '../../utils/animationVariants';
import type { Game, Slot } from '../../bindings';

const ROLE_META = {
    0: { icon: '🔪', label: 'Mafia', color: 'var(--role-mafia)', desc: 'Eliminate a Town player each night.' },
    1: { icon: '👤', label: 'Villager', color: 'var(--role-villager)', desc: 'Villagers sleep — AI handles your pass automatically.' },
    2: { icon: '💊', label: 'Doctor', color: 'var(--role-doctor)', desc: 'Protect one player from being killed each night.' },
    3: { icon: '⭐', label: 'Sheriff', color: 'var(--role-sheriff)', desc: 'Investigate one player each night to reveal their team.' },
};

interface NightScreenProps {
    game: Game;
    sid: number;
    me: Slot | null;
    myIdx: number;
    inGame: boolean;
    loading: boolean;
    pendingCount: number;
    zkProof: any;
    slotName: (sl: Slot, i: number) => string;
    slotIcon: (sl: Slot) => string;
    onAction: (target: number) => void;
    onResolve: () => void;
    lastEventPanel: React.ReactNode;
    zkProofPanel: React.ReactNode;
}

export function NightScreen({
    game,
    sid,
    me,
    myIdx,
    inGame,
    loading,
    pendingCount,
    zkProof,
    slotName,
    slotIcon,
    onAction,
    onResolve,
    lastEventPanel,
    zkProofPanel
}: NightScreenProps) {
    const [roleRevealed, setRoleRevealed] = useState(false);

    const rm = me ? ROLE_META[me.role as keyof typeof ROLE_META] : null;
    const alive = game.slots.map((sl, i) => ({ sl, i })).filter(x => x.sl.alive);
    const townAlive = alive.filter(x => x.sl.role !== 0); // 0 = Mafia

    return (
        <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}
        >
            {lastEventPanel}

            <AnimatePresence>
                {me && rm && (
                    <motion.div
                        variants={roleCardVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover="hover"
                        onClick={() => setRoleRevealed(true)}
                        style={{ cursor: !roleRevealed ? 'pointer' : 'default' }}
                    >
                        {!roleRevealed ? (
                            <NeonCard glowColor="default" style={{ textAlign: 'center', padding: '2rem' }}>
                                <div style={{ fontSize: '3rem', animation: 'float 3s ease-in-out infinite' }}>🃏</div>
                                <h3 style={{ marginTop: '1rem', margin: 0 }}>Tap to Reveal Role</h3>
                            </NeonCard>
                        ) : (
                            <RoleCard
                                icon={rm.icon}
                                label={rm.label}
                                desc={rm.desc}
                                color={rm.color}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div variants={cardVariants} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <NeonCard glowColor="purple">
                    {!inGame ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
                            👁 You are spectating this game.
                        </div>
                    ) : !me?.alive ? (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
                            💀 Eliminated — you watch in silence.
                        </div>
                    ) : me?.submitted ? (
                        <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1, rotate: 360 }}
                                transition={{ type: 'spring', damping: 15 }}
                                style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(57, 255, 20, 0.5))' }}
                            >
                                ✅
                            </motion.div>
                            <h3 style={{ color: 'var(--status-success)', margin: '0 0 0.5rem 0' }}>Action Submitted!</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                {pendingCount > 0 ? `Waiting for ${pendingCount} more player${pendingCount > 1 ? 's' : ''}...` : 'All done — resolve when ready.'}
                            </p>
                            {zkProof && zkProofPanel}
                        </div>
                    ) : me?.role === 1 ? ( // Villager
                        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                            <div style={{ fontSize: '3rem', animation: 'pulse 2s infinite' }}>😴</div>
                            <h3 style={{ color: 'var(--text-secondary)', margin: '1rem 0 0.5rem 0' }}>Auto-passing...</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Villagers sleep through the night.</p>
                        </div>
                    ) : (
                        <motion.div variants={staggerContainer} initial="initial" animate="animate">
                            {me.role === 0 && ( // Mafia
                                <>
                                    <h3 style={{ color: 'var(--role-mafia)', marginTop: 0, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="animate-pulse">🔪</span> Target to Eliminate:
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {townAlive.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No Town players alive.</p>
                                        ) : townAlive.map(({ sl, i }) => (
                                            <ActionButton
                                                key={i}
                                                variant="danger"
                                                icon={slotIcon(sl)}
                                                targetName={slotName(sl, i)}
                                                onClick={() => onAction(i)}
                                                disabled={loading}
                                            >
                                                Eliminate Target
                                            </ActionButton>
                                        ))}
                                    </div>
                                </>
                            )}
                            {me.role === 2 && ( // Doctor
                                <>
                                    <h3 style={{ color: 'var(--role-doctor)', marginTop: 0, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="animate-pulse">💊</span> Target to Protect:
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {alive.map(({ sl, i }) => (
                                            <ActionButton
                                                key={i}
                                                variant="success"
                                                icon={slotIcon(sl)}
                                                targetName={slotName(sl, i)}
                                                onClick={() => onAction(i)}
                                                disabled={loading}
                                            >
                                                Protect Player
                                            </ActionButton>
                                        ))}
                                    </div>
                                </>
                            )}
                            {me.role === 3 && ( // Sheriff
                                <>
                                    <h3 style={{ color: 'var(--role-sheriff)', marginTop: 0, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="animate-pulse">⭐</span> Target to Investigate:
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {alive.filter(({ i }) => i !== myIdx).map(({ sl, i }) => (
                                            <ActionButton
                                                key={i}
                                                variant="warning"
                                                icon={slotIcon(sl)}
                                                targetName={slotName(sl, i)}
                                                onClick={() => onAction(i)}
                                                disabled={loading}
                                            >
                                                Investigate
                                            </ActionButton>
                                        ))}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    <div style={{ margin: '1.5rem 0', height: '1px', background: 'rgba(255,255,255,0.1)' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {pendingCount > 0
                                ? `${pendingCount} human${pendingCount > 1 ? 's' : ''} yet to act. Resolve early?`
                                : 'All humans ready — resolve now:'}
                        </div>
                        <NeonButton
                            variant="primary"
                            glow={pendingCount === 0}
                            onClick={onResolve}
                            loading={loading}
                            style={{ background: pendingCount === 0 ? 'var(--neon-purple)' : undefined }}
                        >
                            ⚡ Resolve Night
                        </NeonButton>
                    </div>
                </NeonCard>
            </motion.div>
        </motion.div>
    );
}
