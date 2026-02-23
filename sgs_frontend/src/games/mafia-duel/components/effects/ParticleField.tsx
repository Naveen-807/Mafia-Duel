import { useEffect, useState, useMemo } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions, Container } from '@tsparticles/engine';

interface ParticleFieldProps {
    variant?: 'default' | 'night' | 'day' | 'celebration';
    intensity?: 'low' | 'medium' | 'high';
}

export function ParticleField({ variant = 'default', intensity = 'medium' }: ParticleFieldProps) {
    const [init, setInit] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    const particleCount = useMemo(() => {
        switch (intensity) {
            case 'low': return 30;
            case 'medium': return 60;
            case 'high': return 100;
        }
    }, [intensity]);

    const colors = useMemo(() => {
        switch (variant) {
            case 'night':
                return ['#8b5cf6', '#6366f1', '#a855f7', '#c084fc'];
            case 'day':
                return ['#fbbf24', '#f59e0b', '#fcd34d', '#fde68a'];
            case 'celebration':
                return ['#ffd700', '#ff00ff', '#00f5ff', '#39ff14', '#ff073a'];
            default:
                return ['#00f5ff', '#bf00ff', '#8b5cf6', '#c4b5fd'];
        }
    }, [variant]);

    const options: ISourceOptions = useMemo(
        () => ({
            background: {
                color: {
                    value: 'transparent',
                },
            },
            fpsLimit: 60,
            interactivity: {
                events: {
                    onClick: {
                        enable: variant === 'celebration',
                        mode: 'push',
                    },
                    onHover: {
                        enable: true,
                        mode: 'grab',
                    },
                },
                modes: {
                    push: {
                        quantity: 4,
                    },
                    grab: {
                        distance: 140,
                        links: {
                            opacity: 0.3,
                        },
                    },
                },
            },
            particles: {
                color: {
                    value: colors,
                },
                links: {
                    color: colors[0],
                    distance: 150,
                    enable: true,
                    opacity: 0.15,
                    width: 1,
                },
                move: {
                    direction: 'none',
                    enable: true,
                    outModes: {
                        default: 'bounce',
                    },
                    random: true,
                    speed: variant === 'celebration' ? 3 : 1,
                    straight: false,
                },
                number: {
                    density: {
                        enable: true,
                    },
                    value: particleCount,
                },
                opacity: {
                    value: {
                        min: 0.1,
                        max: 0.5,
                    },
                    animation: {
                        enable: true,
                        speed: 1,
                        sync: false,
                    },
                },
                shape: {
                    type: 'circle',
                },
                size: {
                    value: {
                        min: 1,
                        max: variant === 'celebration' ? 4 : 3,
                    },
                },
            },
            detectRetina: true,
        }),
        [colors, particleCount, variant]
    );

    const particlesLoaded = async (container?: Container): Promise<void> => {
        // Particles loaded callback
    };

    if (!init) return null;

    return (
        <Particles
            id="tsparticles"
            particlesLoaded={particlesLoaded}
            options={options}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
                pointerEvents: 'none',
            }}
        />
    );
}