import React from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../cards/NeonCard';
import { NeonButton } from '../ui/NeonButton';
import { Badge } from '../ui/Badge';
import { staggerContainer, gameOverVariants } from '../../utils/animationVariants';
import type { Game, Slot } from '../../bindings';

const ROLE_META = {
    0: { icon: '🔪', label: 'Mafia', color: 'var(--role-mafia)', bg: 'var(--role-mafia-bg)' },
    1: { icon: '👤', label: 'Villager', color: 'var(--role-villager)', bg: 'var(--role-villager-bg)' },
    2: { icon: '💊', label: 'Doctor', color: 'var(--role-doctor)', bg: 'var(--role-doctor-bg)' },
    3: { icon: '⭐', label: 'Sheriff', color: 'var(--role-sheriff)', bg: 'var(--role-sheriff-bg)' },
};

interface GameOverScreenProps {
    game: Game;
    userAddress: string;
    onPlayAgain: () => void;
    slotName: (sl: Slot, i: number) => string;
    slotIcon: (sl: Slot) => string;
    TEAM_TOWN: number;
}

export function GameOverScreen({
    game,
    userAddress,
    onPlayAgain,
    slotName,
    slotIcon,
    TEAM_TOWN
}: GameOverScreenProps) {
    const townWon = Number(game.winner) === TEAM_TOWN;
    const resultColor = townWon ? 'var(--status-success)' : 'var(--neon-red)';
    const resultGlow = townWon ? 'green' : 'red';
    const resultIcon = townWon ? '🏆' : '😈';
    const resultTitle = townWon ? 'Town Wins!' : 'Mafia Wins!';
    const resultDesc = townWon ? 'Justice prevailed — all Mafia eliminated.' : 'The Mafia seized control of the town.';

    // Sort players so living players or winners might appear at the top
    const sortedSlots = [...game.slots].map((sl, i) => ({ sl, originalIndex: i }))
        .sort((a, b) => {
            if (a.sl.alive !== b.sl.alive) return a.sl.alive ? -1 : 1;
            return 0; // maintain order otherwise
        });

    return (
        <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, width: '100%' }}
        >
            <motion.div variants={gameOverVariants} custom={townWon ? 1 : -1}>
                <NeonCard glowColor={resultGlow} intensity="high" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                    <div className="animate-float" style={{ fontSize: '4rem', filter: `drop-shadow(0 0 20px ${resultColor})` }}>
                        {resultIcon}
                    </div>
                    <h1 style={{
                        fontSize: '3rem',
                        fontWeight: 900,
                        color: resultColor,
                        fontFamily: 'var(--font-display)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        margin: '1rem 0 0.5rem 0'
                    }}>
                        {resultTitle}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', letterSpacing: '0.05em', margin: 0 }}>
                        {resultDesc}
                    </p>
                </NeonCard>
            </motion.div>

            <motion.div variants={gameOverVariants} custom={0}>
                <NeonCard glowColor="purple">
                    <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase'
                    }}>
                        Full Role Reveal
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sortedSlots.map(({ sl, originalIndex }, i) => {
                            const rm = ROLE_META[sl.role as keyof typeof ROLE_META];
                            const isMe = sl.addr === userAddress;

                            return (
                                <motion.div
                                    key={originalIndex}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1, type: 'spring' }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: isMe ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${isMe ? 'rgba(124, 58, 237, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                                        borderRadius: '12px',
                                        opacity: sl.alive ? 1 : 0.6
                                    }}
                                >
                                    <span style={{ fontSize: '1.5rem', filter: sl.alive ? 'drop-shadow(0 0 5px rgba(255,255,255,0.5))' : 'grayscale(1)' }}>{slotIcon(sl)}</span>

                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            fontWeight: 600,
                                            fontSize: '1rem',
                                            color: isMe ? 'var(--neon-purple)' : 'var(--text-primary)',
                                            textDecoration: sl.alive ? 'none' : 'line-through'
                                        }}>
                                            {slotName(sl, originalIndex)}
                                        </span>
                                        {isMe && <Badge variant="mafia" style={{ background: 'transparent', border: 'none', color: 'var(--neon-purple)', fontSize: '0.65rem' }}>YOU</Badge>}
                                    </div>

                                    <Badge style={{ background: rm.bg, color: rm.color, borderColor: rm.color }}>
                                        {rm.icon} {rm.label}
                                    </Badge>

                                    <div style={{ width: '24px', textAlign: 'center', fontSize: '1rem' }}>
                                        {sl.alive ? '🟢' : '💀'}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </NeonCard>
            </motion.div>

            <motion.div variants={gameOverVariants} custom={2}>
                <NeonButton
                    variant="ghost"
                    size="lg"
                    onClick={onPlayAgain}
                    style={{ background: 'rgba(255,255,255,0.05)', marginTop: '1rem' }}
                >
                    🔄 Play Again
                </NeonButton>
            </motion.div>
        </motion.div>
    );
}
