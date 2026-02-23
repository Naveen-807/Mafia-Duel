import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageVariants } from '../../utils/animationVariants';
import { ParticleField } from '../effects/ParticleField';

interface GameLayoutProps {
    children: React.ReactNode;
    phase?: 'lobby' | 'night' | 'day' | 'over';
    showParticles?: boolean;
}

export function GameLayout({ children, phase, showParticles = true }: GameLayoutProps) {
    const getParticleVariant = () => {
        switch (phase) {
            case 'lobby': return 'default';
            case 'night': return 'night';
            case 'day': return 'day';
            case 'over': return 'celebration';
            default: return 'default';
        }
    };

    const getPhaseBackground = () => {
        switch (phase) {
            case 'lobby': return 'var(--phase-lobby-bg)';
            case 'night': return 'var(--phase-night-bg)';
            case 'day': return 'var(--phase-day-bg)';
            case 'over': return 'var(--phase-over-bg)';
            default: return 'linear-gradient(135deg, var(--casino-dark) 0%, var(--casino-void) 100%)';
        }
    };

    return (
        <div style={{
            position: 'relative',
            minHeight: '100vh',
            width: '100%',
            overflowX: 'hidden',
            background: getPhaseBackground(),
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            transition: 'background 0.8s ease-in-out',
        }}>
            {/* Scanline overlay for cyberpunk feel */}
            <div className="scanline-overlay" />

            {/* Particle background */}
            {showParticles && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                    <ParticleField variant={getParticleVariant()} />
                </div>
            )}

            {/* Main Content Area */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                maxWidth: '600px',
                margin: '0 auto',
                padding: '2rem 1rem',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={phase || 'home'}
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
