import React from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../cards/NeonCard';
import { ActionButton, NeonButton } from '../ui/NeonButton';
import { staggerContainer, cardVariants } from '../../utils/animationVariants';
import type { Game, Slot } from '../../bindings';

interface DayScreenProps {
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
    PASS_TARGET: number;
}

export function DayScreen({
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
    zkProofPanel,
    PASS_TARGET
}: DayScreenProps) {
    const alive = game.slots.map((sl, i) => ({ sl, i })).filter(x => x.sl.alive);

    return (
        <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}
        >
            {lastEventPanel}

            <motion.div variants={cardVariants} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Day Phase specific glowing color: gold/orange */}
                <NeonCard glowColor="gold">
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.4))' }}>
                            ☀️
                        </div>
                        <h2 style={{ color: 'var(--neon-gold)', margin: '0.5rem 0 0 0', fontFamily: 'var(--font-display)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Town Meeting
                        </h2>
                    </div>

                    {!inGame ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
                            👁 You are spectating this game.
                        </div>
                    ) : !me?.alive ? (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
                            💀 Eliminated — you watch the vote from beyond.
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
                            <h3 style={{ color: 'var(--status-success)', margin: '0 0 0.5rem 0' }}>Vote Cast!</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                {pendingCount > 0 ? `Waiting for ${pendingCount} more player${pendingCount > 1 ? 's' : ''}...` : 'All done — resolve when ready.'}
                            </p>
                            {zkProof && zkProofPanel}
                        </div>
                    ) : (
                        <motion.div variants={staggerContainer} initial="initial" animate="animate">
                            <h3 style={{ color: 'var(--neon-gold)', marginTop: 0, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="animate-pulse">🗳️</span> Vote to Eliminate a Suspect:
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
                                        Cast Vote
                                    </ActionButton>
                                ))}
                                <div style={{ margin: '0.5rem 0', height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                                <NeonButton
                                    variant="ghost"
                                    onClick={() => onAction(PASS_TARGET)}
                                    disabled={loading}
                                    style={{ fontStyle: 'italic', letterSpacing: '1px' }}
                                >
                                    🤷 Abstain (No Vote)
                                </NeonButton>
                            </div>
                        </motion.div>
                    )}

                    <div style={{ margin: '1.5rem 0', height: '1px', background: 'rgba(255,255,255,0.1)' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {pendingCount > 0
                                ? `${pendingCount} human${pendingCount > 1 ? 's' : ''} yet to vote. Resolve early or wait:`
                                : 'All votes in — resolve now:'}
                        </div>
                        <NeonButton
                            variant="primary"
                            glow={pendingCount === 0}
                            onClick={onResolve}
                            loading={loading}
                            style={{ background: pendingCount === 0 ? 'var(--neon-gold)' : undefined, color: pendingCount === 0 ? '#000' : undefined }}
                        >
                            ⚡ Resolve Day Vote
                        </NeonButton>
                    </div>
                </NeonCard>
            </motion.div>
        </motion.div>
    );
}
