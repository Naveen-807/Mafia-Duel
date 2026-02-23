import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { badgeVariants } from '../../utils/animationVariants';

export type BadgeVariant = 'mafia' | 'villager' | 'doctor' | 'sheriff' | 'success' | 'warning' | 'error' | 'info' | 'ghost';

interface BadgeProps extends Omit<HTMLMotionProps<'span'>, 'children'> {
    variant?: BadgeVariant;
    icon?: string | React.ReactNode;
    children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
    mafia: `background: var(--role-mafia-bg); color: var(--role-mafia); border: 1px solid var(--role-mafia);`,
    villager: `background: var(--role-villager-bg); color: var(--role-villager); border: 1px solid var(--role-villager);`,
    doctor: `background: var(--role-doctor-bg); color: var(--role-doctor); border: 1px solid var(--role-doctor);`,
    sheriff: `background: var(--role-sheriff-bg); color: var(--role-sheriff); border: 1px solid var(--role-sheriff);`,
    success: `background: var(--status-success-bg); color: var(--status-success); border: 1px solid var(--status-success);`,
    warning: `background: var(--status-warning-bg); color: var(--status-warning); border: 1px solid var(--status-warning);`,
    error: `background: var(--status-error-bg); color: var(--status-error); border: 1px solid var(--status-error);`,
    info: `background: var(--status-info-bg); color: var(--status-info); border: 1px solid var(--status-info);`,
    ghost: `background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid rgba(255, 255, 255, 0.1);`,
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ variant = 'ghost', icon, children, style, ...props }, ref) => {
        const baseStyle = `
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.25rem 0.625rem;
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            font-family: var(--font-body);
            white-space: nowrap;
            ${variantStyles[variant]}
        `;

        return (
            <motion.span
                ref={ref}
                style={{
                    ...style,
                    cssText: baseStyle,
                } as React.CSSProperties}
                variants={badgeVariants}
                initial="initial"
                animate="animate"
                whileHover="hover"
                {...props}
            >
                {icon && <span>{icon}</span>}
                {children}
            </motion.span>
        );
    }
);

Badge.displayName = 'Badge';
