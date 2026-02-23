import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoleCard, NeonCard } from '../cards/NeonCard';
import { NeonButton } from '../ui/NeonButton';
import { staggerContainer, slideInUp, roleCardVariants } from '../../utils/animationVariants';
import type { Game, Slot } from '../../bindings';

const ROLE_META = {
    0: { icon: '🔪', label: 'Mafia', color: 'var(--role-mafia)', desc: 'Eliminate a Town player each night.' },
    1: { icon: '👤', label: 'Villager', color: 'var(--role-villager)', desc: 'Villagers sleep — AI handles your pass automatically.' },
    2: { icon: '💊', label: 'Doctor', color: 'var(--role-doctor)', desc: 'Protect one player from being killed each night.' },
    3: { icon: '⭐', label: 'Sheriff', color: 'var(--role-sheriff)', desc: 'Investigate one player each night to reveal their team.' },
};

interface NightRevealScreenProps {
    game: Game;
    sid: number;
    me: Slot | null;
    inGame: boolean;
    loading: boolean;
    pendingCount: number;
    zkProof: any;
    storedTargetLabel: string;
    onReveal: () => void;
    onResolve: () => void;
    zkProofPanel: React.ReactNode;
}

export function NightRevealScreen({
    me,
    inGame,
    loading,
    pendingCount,
    zkProof,
    storedTargetLabel,
    onReveal,
    onResolve,
    zkProofPanel
}: NightRevealScreenProps) {
    const [roleRevealed, setRoleRevealed] = useState(false);
    const rm = me ? ROLE_META[me.role as keyof typeof ROLE_META] : null;

    return (
        <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}
        >
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
                                desc="All players committed — time to reveal."
                                color={rm.color}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div variants={slideInUp} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <NeonCard glowColor="purple">
                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 9, padding: '10px 13px', marginBottom: 16, fontSize: '0.875rem', color: '#a5b4fc' }}>
                        🔓 <b>ZK Reveal:</b> The contract will recompute sha256(target‖nonce) and compare it
                        to your stored commitment. A mismatch → InvalidReveal (#12).
                    </div>

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
                            <h3 style={{ color: 'var(--status-success)', margin: '0 0 0.5rem 0' }}>Action Revealed!</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Contract verified your commitment onchain.
                                {pendingCount > 0 ? ` Waiting for ${pendingCount} more...` : ' All revealed — resolve now.'}
                            </p>
                        </div>
                    ) : me?.role === 1 ? ( // Villager
                        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                            <div style={{ fontSize: '3rem', animation: 'pulse 2s infinite' }}>😴</div>
                            <h3 style={{ color: 'var(--text-secondary)', margin: '1rem 0 0.5rem 0' }}>Auto-revealing your pass…</h3>
                        </div>
                    ) : storedTargetLabel ? (
                        <div style={{ padding: '10px 0' }}>
                            {zkProof && zkProofPanel}
                            <div style={{ fontSize: '1rem', color: '#94a3b8', marginTop: 12, marginBottom: 16, textAlign: 'center' }}>
                                You committed to: <b style={{ color: '#e2e8f0', marginLeft: 8, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>{storedTargetLabel}</b>
                            </div>
                            <NeonButton
                                variant="primary"
                                glow
                                size="lg"
                                style={{ width: '100%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}
                                disabled={loading}
                                onClick={onReveal}
                                loading={loading}
                            >
                                🔓 Reveal Action (Verified Onchain)
                            </NeonButton>
                        </div>
                    ) : (
                        <div style={{ color: '#f87171', textAlign: 'center', padding: '1rem', fontSize: '0.875rem' }}>
                            ⚠️ No commitment found for this round. Refresh the page.
                        </div>
                    )}

                    <div style={{ margin: '1.5rem 0', height: '1px', background: 'rgba(255,255,255,0.1)' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {pendingCount > 0
                                ? `${pendingCount} human${pendingCount > 1 ? 's' : ''} yet to reveal. Resolve after all reveal:`
                                : 'All revealed — resolve now:'}
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
