import React from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../cards/NeonCard';
import { NeonButton } from '../ui/NeonButton';
import { Badge } from '../ui/Badge';
import { staggerContainerFast, playerSlotVariants } from '../../utils/animationVariants';
import type { Game, Slot } from '../../bindings';

interface LobbyScreenProps {
    game: Game;
    sid: number;
    userAddress: string;
    loading: boolean;
    onJoin: () => void;
    onStart: () => void;
    onLeave: () => void;
}

export function LobbyScreen({
    game,
    sid,
    userAddress,
    loading,
    onJoin,
    onStart,
    onLeave
}: LobbyScreenProps) {
    const isCreator = game.creator === userAddress;
    const humanCount = game.slots.filter(sl => sl.addr != null).length;
    const alreadyJoined = game.slots.some(sl => sl.addr === userAddress);
    const canJoin = !alreadyJoined;
    const isFull = game.human_count >= 8;

    const shortAddr = (a: string) => a.slice(0, 6) + '…' + a.slice(-4);
    const slotName = (sl: Slot, i: number) => sl.addr ? shortAddr(sl.addr) : `AI Bot #${i + 1}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
            {/* Header Info Banner */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'rgba(124, 58, 237, 0.1)',
                    border: '1px solid rgba(124, 58, 237, 0.3)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 0 20px rgba(124, 58, 237, 0.1)'
                }}
            >
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(124, 58, 237, 0.2)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                }}>📋</div>
                <div style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                    Share <b style={{ color: 'var(--neon-purple)', letterSpacing: '1px' }}>Session #{sid}</b> so others can join.<br />
                    <span style={{ color: 'var(--text-secondary)' }}>Empty slots will be automatically filled by AI.</span>
                </div>
            </motion.div>

            {/* Players Grid Card */}
            <NeonCard glowColor="purple" intensity="low">
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '1.25rem'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Waiting Room
                    </h2>
                    <Badge variant="ghost">{humanCount} / 8 Humans</Badge>
                </div>

                <motion.div
                    variants={staggerContainerFast}
                    initial="initial"
                    animate="animate"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.75rem',
                        marginBottom: '1.5rem'
                    }}
                >
                    {game.slots.map((sl, i) => {
                        const isMe = sl.addr === userAddress;
                        const isHuman = sl.addr != null;

                        return (
                            <motion.div
                                key={`${i}-${sl.addr || 'ai'}`} // Re-animate if slot changes
                                variants={playerSlotVariants}
                                whileHover="hover"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.625rem 0.875rem',
                                    borderRadius: '10px',
                                    background: isMe ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${isMe ? 'var(--neon-purple)' : 'rgba(255, 255, 255, 0.08)'}`,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                {isMe && (
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
                                        background: 'var(--neon-purple)', boxShadow: '0 0 8px var(--neon-purple)'
                                    }} />
                                )}

                                <div style={{
                                    fontSize: '1.25rem',
                                    opacity: isHuman ? 1 : 0.5,
                                    filter: isHuman ? 'drop-shadow(0 0 5px rgba(255,255,255,0.5))' : 'none'
                                }}>
                                    {isHuman ? '🧑' : '🤖'}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: isMe ? 'var(--neon-purple)' : isHuman ? 'var(--text-primary)' : 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {slotName(sl, i)}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px', color: isHuman ? 'var(--status-success)' : 'var(--text-disabled)' }}>
                                        {isHuman ? 'Ready' : 'Waiting...'}
                                    </div>
                                </div>

                                {isMe && <Badge variant="mafia" style={{ background: 'transparent', border: 'none', color: 'var(--neon-purple)', fontSize: '0.65rem' }}>YOU</Badge>}
                            </motion.div>
                        );
                    })}
                </motion.div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {canJoin && !isFull && (
                        <NeonButton variant="success" onClick={onJoin} loading={loading}>
                            🚪 Join This Game
                        </NeonButton>
                    )}
                    {canJoin && isFull && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                            Room is full.
                        </div>
                    )}
                    {isCreator && (
                        <NeonButton variant="primary" onClick={onStart} loading={loading}>
                            ▶ Start Game
                        </NeonButton>
                    )}
                    {alreadyJoined && !isCreator && (
                        <div style={{
                            textAlign: 'center',
                            color: 'var(--neon-cyan)',
                            fontSize: '0.875rem',
                            padding: '0.75rem 0',
                            animation: 'pulse 2s infinite',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}>
                            ⏳ Waiting for host to start the game...
                        </div>
                    )}
                </div>
            </NeonCard>

            <motion.button
                whileHover={{ x: -5, color: 'var(--text-primary)' }}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    alignSelf: 'flex-start',
                    marginTop: '0.5rem'
                }}
                onClick={onLeave}
            >
                ← Leave Room
            </motion.button>
        </motion.div>
    );
}
