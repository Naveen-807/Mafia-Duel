import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { cardGlowVariants } from '../../utils/animationVariants';

export type NeonCardColor = 'cyan' | 'magenta' | 'purple' | 'gold' | 'red' | 'green' | 'default';

interface NeonCardProps extends HTMLMotionProps<'div'> {
    glowColor?: NeonCardColor;
    intensity?: 'low' | 'medium' | 'high';
    interactive?: boolean;
    children: React.ReactNode;
}

const colorMap: Record<NeonCardColor, string> = {
    cyan: 'var(--neon-cyan)',
    magenta: 'var(--neon-magenta)',
    purple: 'var(--neon-purple)',
    gold: 'var(--neon-gold)',
    red: 'var(--neon-red)',
    green: 'var(--neon-green)',
    default: 'rgba(255, 255, 255, 0.1)',
};

export const NeonCard = forwardRef<HTMLDivElement, NeonCardProps>(
    ({
        glowColor = 'purple',
        intensity = 'medium',
        interactive = false,
        children,
        style,
        className = '',
        ...props
    }, ref) => {
        const baseColor = colorMap[glowColor];

        const getShadows = () => {
            if (glowColor === 'default') return `inset 0 1px 0 rgba(255, 255, 255, 0.05)`;

            switch (intensity) {
                case 'low': return `0 0 15px ${baseColor}22, inset 0 1px 0 rgba(255, 255, 255, 0.05)`;
                case 'medium': return `0 0 25px ${baseColor}33, inset 0 1px 0 ${baseColor}22`;
                case 'high': return `0 0 40px ${baseColor}44, inset 0 1px 0 ${baseColor}44`;
                default: return `0 0 25px ${baseColor}33, inset 0 1px 0 rgba(255, 255, 255, 0.05)`;
            }
        };

        const baseStyle: any = {
            background: 'var(--casino-card)',
            border: `1px solid ${glowColor === 'default' ? 'var(--color-border)' : `${baseColor}44`}`,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: getShadows(),
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(10px)',
            ...(style as any),
        };

        return (
            <motion.div
                ref={ref}
                style={baseStyle as any}
                variants={interactive ? cardGlowVariants : undefined}
                initial="initial"
                animate="animate"
                whileHover={interactive ? "hover" : undefined}
                className={className}
                {...props}
            >
                {/* Optional corner accents could go here */}
                {glowColor !== 'default' && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '4px',
                        height: '100%',
                        background: baseColor,
                        boxShadow: `0 0 10px ${baseColor}`,
                    }} />
                )}
                {children}
            </motion.div>
        );
    }
);

NeonCard.displayName = 'NeonCard';

// Export specialized variants
export const RoleCard = ({ roleStr, icon, label, desc, color }: any) => {
    return (
        <NeonCard glowColor="default" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                    width: 56, height: 56, borderRadius: 12,
                    background: `rgba(255, 255, 255, 0.05)`,
                    border: `2px solid ${color ?? 'var(--neon-purple)'}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, flexShrink: 0
                }}>
                    {icon}
                </div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: color ?? 'var(--neon-purple)' }}>
                        {label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {desc}
                    </div>
                </div>
            </div>
        </NeonCard>
    );
};
