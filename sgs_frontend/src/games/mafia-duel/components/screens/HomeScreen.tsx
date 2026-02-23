import React from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../cards/NeonCard';
import { NeonInput } from '../ui/NeonInput';
import { NeonButton } from '../ui/NeonButton';
import { glitchTextVariants, staggerContainer, staggerChild } from '../../utils/animationVariants';

interface HomeScreenProps {
    createSid: string;
    setCreateSid: (val: string) => void;
    wager: string;
    setWager: (val: string) => void;
    joinSid: string;
    setJoinSid: (val: string) => void;
    loading: boolean;
    onCreate: () => void;
    onJoin: () => void;
}

export function HomeScreen({
    createSid,
    setCreateSid,
    wager,
    setWager,
    joinSid,
    setJoinSid,
    loading,
    onCreate,
    onJoin
}: HomeScreenProps) {
    return (
        <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: 1,
            }}
        >
            {/* Title Section */}
            <motion.div
                variants={staggerChild}
                style={{
                    textAlign: 'center',
                    padding: '2rem 0',
                    marginBottom: '1rem'
                }}
            >
                <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ fontSize: '4rem', marginBottom: '0.5rem', filter: 'drop-shadow(0 0 20px rgba(255,0,255,0.5))' }}
                >
                    🕵️
                </motion.div>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <motion.h1
                        variants={glitchTextVariants}
                        style={{
                            fontSize: '3rem',
                            fontWeight: 900,
                            fontFamily: 'var(--font-display)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            margin: 0,
                            color: 'var(--text-primary)',
                            position: 'relative',
                            zIndex: 2,
                        }}
                    >
                        Mafia Duel
                    </motion.h1>
                    {/* Glitch layers */}
                    <h1 style={{
                        fontSize: '3rem', fontWeight: 900, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                        position: 'absolute', top: 0, left: '-2px', color: 'var(--neon-cyan)', zIndex: 1, opacity: 0.7, mixBlendMode: 'screen'
                    }} className="animate-glitchText">Mafia Duel</h1>
                    <h1 style={{
                        fontSize: '3rem', fontWeight: 900, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                        position: 'absolute', top: 0, left: '2px', color: 'var(--neon-magenta)', zIndex: 1, opacity: 0.7, mixBlendMode: 'screen', animationDelay: '0.1s'
                    }} className="animate-glitchText">Mafia Duel</h1>
                </div>
                <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginTop: '1rem',
                    lineHeight: 1.6,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                }}>
                    8 Players • AI Fills Empty Seats<br />
                    <span style={{ color: 'var(--neon-red)' }}>2 Mafia</span> • <span style={{ color: 'var(--neon-green)' }}>1 Doctor</span> • <span style={{ color: 'var(--neon-gold)' }}>1 Sheriff</span> • <span style={{ color: 'var(--text-muted)' }}>4 Villager</span>
                </p>
            </motion.div>

            {/* Action Cards */}
            <motion.div variants={staggerChild}>
                <NeonCard glowColor="purple" intensity="low" style={{ marginBottom: '1rem' }} interactive>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🏠</span>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Create a Room</h2>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                        <NeonInput
                            label="Session ID (Any Number)"
                            placeholder="e.g. 42069"
                            type="number"
                            value={createSid}
                            onChange={(e) => setCreateSid(e.target.value)}
                            disabled={loading}
                        />
                        <NeonInput
                            label="Wager (Points)"
                            placeholder="100"
                            type="number"
                            value={wager}
                            onChange={(e) => setWager(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <NeonButton
                        variant="primary"
                        onClick={onCreate}
                        loading={loading}
                    >
                        + Create Room
                    </NeonButton>
                </NeonCard>
            </motion.div>

            <motion.div variants={staggerChild}>
                <NeonCard glowColor="green" intensity="low" style={{ marginBottom: '1.5rem' }} interactive>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🚪</span>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Join a Room</h2>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <NeonInput
                            label="Session ID from host"
                            placeholder="Paste session ID here"
                            type="number"
                            value={joinSid}
                            onChange={(e) => setJoinSid(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <NeonButton
                        variant="success"
                        onClick={onJoin}
                        loading={loading}
                    >
                        → Join Room
                    </NeonButton>
                </NeonCard>
            </motion.div>

            <motion.div variants={staggerChild}>
                <NeonCard glowColor="default" style={{ opacity: 0.8 }}>
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase'
                    }}>
                        How to Play (Dev)
                    </div>
                    <ol style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.8,
                        margin: 0,
                        paddingLeft: '1.25rem'
                    }}>
                        <li><span style={{ color: 'var(--text-primary)' }}>P1</span> creates a room with any session ID.</li>
                        <li>Switch to <span style={{ color: 'var(--text-primary)' }}>P2</span> → enter same ID → Join.</li>
                        <li>Switch back to <span style={{ color: 'var(--text-primary)' }}>P1</span> → click Start Game.</li>
                        <li>Villagers auto-pass each night — no action needed.</li>
                        <li>Other roles pick targets; then click Resolve.</li>
                        <li>Day: everyone votes; click Resolve Day Vote.</li>
                    </ol>
                </NeonCard>
            </motion.div>
        </motion.div>
    );
}
