import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef, useState } from 'react';
import { inputVariants } from '../../utils/animationVariants';

interface NeonInputProps extends Omit<HTMLMotionProps<'input'>, 'type'> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    type?: 'text' | 'number' | 'password';
}

export const NeonInput = forwardRef<HTMLInputElement, NeonInputProps>(
    ({ label, error, icon, type = 'text', style, ...props }, ref) => {
        const [isFocused, setIsFocused] = useState(false);

        const baseStyle: React.CSSProperties = {
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${error ? 'var(--neon-red)' : isFocused ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '10px',
            padding: icon ? '0.75rem 1rem 0.75rem 2.5rem' : '0.75rem 1rem',
            color: '#e2e8f0',
            fontSize: '0.875rem',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: isFocused
                ? '0 0 20px rgba(0, 245, 255, 0.2), inset 0 0 10px rgba(0, 245, 255, 0.05)'
                : 'none',
            fontFamily: 'var(--font-body)',
        };

        return (
            <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
                {label && (
                    <motion.label
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: error ? 'var(--neon-red)' : '#64748b',
                            marginBottom: '0.5rem',
                            fontFamily: 'var(--font-display)',
                        }}
                    >
                        {label}
                    </motion.label>
                )}
                <div style={{ position: 'relative' }}>
                    {icon && (
                        <span style={{
                            position: 'absolute',
                            left: '0.875rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '1rem',
                            opacity: 0.5,
                            pointerEvents: 'none',
                        }}>
                            {icon}
                        </span>
                    )}
                    <motion.input
                        ref={ref}
                        type={type}
                        style={{ ...baseStyle, ...style }}
                        onFocus={(e) => {
                            setIsFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            props.onBlur?.(e);
                        }}
                        variants={inputVariants}
                        animate={isFocused ? 'focus' : 'initial'}
                        {...props}
                    />
                </div>
                {error && (
                    <motion.span
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: 'var(--neon-red)',
                            marginTop: '0.25rem',
                        }}
                    >
                        {error}
                    </motion.span>
                )}
            </div>
        );
    }
);

NeonInput.displayName = 'NeonInput';

export default NeonInput;