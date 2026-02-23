import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { buttonVariants, neonButtonVariants } from '../../utils/animationVariants';

type NeonButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
type NeonButtonSize = 'sm' | 'md' | 'lg';

interface NeonButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
    variant?: NeonButtonVariant;
    size?: NeonButtonSize;
    glow?: boolean;
    loading?: boolean;
    children: React.ReactNode;
}

const variantStyles: Record<NeonButtonVariant, string> = {
    primary: `
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
    border: 1px solid rgba(139, 92, 246, 0.5);
    color: #ffffff;
  `,
    secondary: `
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  `,
    danger: `
    background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
    border: 1px solid rgba(220, 38, 38, 0.5);
    color: #ffffff;
  `,
    success: `
    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
    border: 1px solid rgba(34, 197, 94, 0.5);
    color: #ffffff;
  `,
    warning: `
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    border: 1px solid rgba(251, 191, 36, 0.5);
    color: #ffffff;
  `,
    ghost: `
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
  `,
};

const sizeStyles: Record<NeonButtonSize, string> = {
    sm: 'padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 8px;',
    md: 'padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 12px;',
    lg: 'padding: 1rem 2rem; font-size: 1.125rem; border-radius: 16px;',
};

const glowStyles: Record<NeonButtonVariant, string> = {
    primary: 'box-shadow: 0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2);',
    secondary: 'box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);',
    danger: 'box-shadow: 0 0 20px rgba(220, 38, 38, 0.4), 0 0 40px rgba(220, 38, 38, 0.2);',
    success: 'box-shadow: 0 0 20px rgba(34, 197, 94, 0.4), 0 0 40px rgba(34, 197, 94, 0.2);',
    warning: 'box-shadow: 0 0 20px rgba(251, 191, 36, 0.4), 0 0 40px rgba(251, 191, 36, 0.2);',
    ghost: 'box-shadow: none;',
};

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
    ({
        variant = 'primary',
        size = 'md',
        glow = true,
        loading = false,
        disabled,
        children,
        style,
        ...props
    }, ref) => {
        const baseStyle = `
      width: 100%;
      font-weight: 700;
      letter-spacing: 0.3px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-family: var(--font-body);
      position: relative;
      overflow: hidden;
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${glow ? glowStyles[variant] : ''}
      ${disabled || loading ? 'opacity: 0.5; cursor: not-allowed;' : ''}
    `;

        return (
            <motion.button
                ref={ref}
                style={{
                    ...style,
                    cssText: baseStyle,
                } as React.CSSProperties}
                variants={buttonVariants}
                initial="initial"
                whileHover={!disabled && !loading ? "hover" : undefined}
                whileTap={!disabled && !loading ? "tap" : undefined}
                disabled={disabled || loading}
                {...props}
            >
                {loading && (
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{ display: 'inline-flex' }}
                    >
                        ⏳
                    </motion.span>
                )}
                {children}
            </motion.button>
        );
    }
);

NeonButton.displayName = 'NeonButton';

// Specialized button for actions (Mafia kill, Doctor save, etc.)
interface ActionButtonProps extends NeonButtonProps {
    icon?: React.ReactNode;
    targetName?: string;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
    ({ icon, targetName, children, variant = 'secondary', ...props }, ref) => {
        return (
            <NeonButton
                ref={ref}
                variant={variant}
                size="md"
                {...props}
                style={{
                    ...props.style,
                    justifyContent: 'flex-start',
                    padding: '0.75rem 1rem',
                } as React.CSSProperties}
            >
                {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
                <span style={{ flex: 1 }}>{children}</span>
                {targetName && (
                    <span style={{
                        fontSize: '0.75rem',
                        opacity: 0.7,
                        marginLeft: 'auto',
                    }}>
                        {targetName}
                    </span>
                )}
            </NeonButton>
        );
    }
);

ActionButton.displayName = 'ActionButton';

export default NeonButton;