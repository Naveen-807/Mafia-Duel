import type { Variants, Transition } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   TRANSITION PRESETS
   ═══════════════════════════════════════════════════════════ */

export const transitions = {
    fast: { duration: 0.15, ease: [0.4, 0, 0.2, 1] } as Transition,
    normal: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as Transition,
    slow: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } as Transition,
    spring: { type: 'spring', stiffness: 300, damping: 30 } as Transition,
    springBouncy: { type: 'spring', stiffness: 400, damping: 15 } as Transition,
    springStiff: { type: 'spring', stiffness: 500, damping: 30 } as Transition,
};

export const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } };
export const slideInUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

/* ═══════════════════════════════════════════════════════════
   PAGE TRANSITIONS
   ═══════════════════════════════════════════════════════════ */

export const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.98,
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: transitions.slow,
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.98,
        transition: transitions.fast,
    },
};

/* ═══════════════════════════════════════════════════════════
   CARD ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const cardVariants: Variants = {
    initial: {
        opacity: 0,
        y: 30,
        scale: 0.95,
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: transitions.spring,
    },
    hover: {
        y: -4,
        scale: 1.02,
        transition: transitions.fast,
    },
    tap: {
        scale: 0.98,
        transition: transitions.fast,
    },
};

export const cardGlowVariants: Variants = {
    initial: {
        boxShadow: '0 0 0px rgba(139, 92, 246, 0)',
    },
    animate: {
        boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)',
        transition: transitions.normal,
    },
    hover: {
        boxShadow: '0 0 50px rgba(139, 92, 246, 0.4), 0 0 80px rgba(139, 92, 246, 0.2)',
        transition: transitions.normal,
    },
};

/* ═══════════════════════════════════════════════════════════
   STAGGER CONTAINER
   ═══════════════════════════════════════════════════════════ */

export const staggerContainer: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

export const staggerContainerFast: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.05,
        },
    },
};

export const staggerContainerSlow: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.2,
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   STAGGER CHILDREN
   ═══════════════════════════════════════════════════════════ */

export const staggerChild: Variants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.95,
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: transitions.spring,
    },
};

export const staggerChildFade: Variants = {
    initial: { opacity: 0 },
    animate: {
        opacity: 1,
        transition: transitions.normal,
    },
};

/* ═══════════════════════════════════════════════════════════
   BUTTON ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const buttonVariants: Variants = {
    initial: {
        scale: 1,
    },
    hover: {
        scale: 1.02,
        transition: transitions.fast,
    },
    tap: {
        scale: 0.98,
        transition: transitions.fast,
    },
    disabled: {
        opacity: 0.5,
        scale: 1,
    },
};

export const neonButtonVariants: Variants = {
    initial: {
        boxShadow: '0 0 5px var(--neon-cyan), 0 0 10px var(--neon-cyan)',
    },
    hover: {
        boxShadow: '0 0 15px var(--neon-cyan), 0 0 30px var(--neon-cyan), 0 0 45px var(--neon-cyan)',
        transition: transitions.fast,
    },
    tap: {
        boxShadow: '0 0 3px var(--neon-cyan)',
        transition: transitions.fast,
    },
};

/* ═══════════════════════════════════════════════════════════
   ROLE CARD ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const roleCardVariants: Variants = {
    hidden: {
        rotateY: 180,
        scale: 0.8,
        opacity: 0,
    },
    visible: {
        rotateY: 0,
        scale: 1,
        opacity: 1,
        transition: {
            type: 'spring',
            stiffness: 200,
            damping: 20,
            duration: 0.8,
        },
    },
    hover: {
        scale: 1.05,
        transition: transitions.fast,
    },
};

export const roleIconVariants: Variants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
        scale: 1,
        rotate: 0,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 15,
            delay: 0.3,
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   PLAYER SLOT ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const playerSlotVariants: Variants = {
    initial: {
        opacity: 0,
        x: -20,
        scale: 0.95,
    },
    animate: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: transitions.spring,
    },
    hover: {
        scale: 1.02,
        x: 4,
        transition: transitions.fast,
    },
    eliminated: {
        opacity: 0.4,
        filter: 'grayscale(100%)',
        scale: 0.98,
        transition: transitions.normal,
    },
};

export const playerJoinVariants: Variants = {
    initial: {
        opacity: 0,
        scale: 0.5,
        y: -20,
    },
    animate: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 400,
            damping: 15,
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   TOAST/NOTIFICATION ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const toastVariants: Variants = {
    initial: {
        opacity: 0,
        y: -20,
        scale: 0.95,
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: transitions.spring,
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.95,
        transition: transitions.fast,
    },
};

export const errorShakeVariants: Variants = {
    animate: {
        x: [0, -5, 5, -5, 5, 0],
        transition: {
            duration: 0.4,
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   PHASE TRANSITION ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const phaseTransitionVariants: Variants = {
    initial: {
        opacity: 0,
        scale: 1.2,
        filter: 'blur(10px)',
    },
    animate: {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
        },
    },
    exit: {
        opacity: 0,
        scale: 0.8,
        filter: 'blur(10px)',
        transition: {
            duration: 0.4,
        },
    },
};

export const nightTransitionVariants: Variants = {
    initial: {
        opacity: 0,
        filter: 'brightness(0.3) blur(10px)',
    },
    animate: {
        opacity: 1,
        filter: 'brightness(1) blur(0px)',
        transition: {
            duration: 0.8,
            ease: 'easeOut',
        },
    },
};

export const dayTransitionVariants: Variants = {
    initial: {
        opacity: 0,
        filter: 'brightness(1.5) blur(10px)',
    },
    animate: {
        opacity: 1,
        filter: 'brightness(1) blur(0px)',
        transition: {
            duration: 0.8,
            ease: 'easeOut',
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   GAME OVER ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const gameOverVariants: Variants = {
    initial: {
        opacity: 0,
        scale: 0.5,
        rotate: -10,
    },
    animate: {
        opacity: 1,
        scale: 1,
        rotate: 0,
        transition: {
            type: 'spring',
            stiffness: 200,
            damping: 15,
        },
    },
};

export const winnerBannerVariants: Variants = {
    initial: {
        opacity: 0,
        y: -50,
        scale: 0.8,
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 150,
            damping: 20,
            delay: 0.2,
        },
    },
};

export const roleRevealItemVariants: Variants = {
    initial: {
        opacity: 0,
        x: -30,
        rotateY: 90,
    },
    animate: {
        opacity: 1,
        x: 0,
        rotateY: 0,
        transition: {
            type: 'spring',
            stiffness: 200,
            damping: 20,
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   INPUT FIELD ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const inputVariants: Variants = {
    initial: {
        boxShadow: '0 0 0px rgba(0, 245, 255, 0)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    focus: {
        boxShadow: '0 0 20px rgba(0, 245, 255, 0.3)',
        borderColor: 'var(--neon-cyan)',
        transition: transitions.fast,
    },
};

/* ═══════════════════════════════════════════════════════════
   LOADING ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const loadingPulseVariants: Variants = {
    animate: {
        opacity: [0.5, 1, 0.5],
        scale: [0.98, 1, 0.98],
        transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
        },
    },
};

export const loadingDotsVariants: Variants = {
    animate: {
        opacity: [0, 1, 0],
        transition: {
            duration: 1,
            repeat: Infinity,
            repeatDelay: 0.5,
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   VOTE/ACTION ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const voteButtonVariants: Variants = {
    initial: {
        scale: 1,
        boxShadow: '0 0 0px rgba(255, 215, 0, 0)',
    },
    hover: {
        scale: 1.02,
        boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
        transition: transitions.fast,
    },
    tap: {
        scale: 0.98,
    },
    selected: {
        scale: 1,
        boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
        transition: transitions.normal,
    },
};

export const actionButtonVariants: Variants = {
    initial: {
        scale: 1,
    },
    hover: {
        scale: 1.02,
        transition: transitions.fast,
    },
    tap: {
        scale: 0.98,
    },
    submitted: {
        opacity: 0.6,
        scale: 0.98,
        transition: transitions.normal,
    },
};

/* ═══════════════════════════════════════════════════════════
   BADGE ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const badgeVariants: Variants = {
    initial: {
        opacity: 0,
        scale: 0.5,
    },
    animate: {
        opacity: 1,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 400,
            damping: 15,
        },
    },
    hover: {
        scale: 1.1,
        transition: transitions.fast,
    },
};

/* ═══════════════════════════════════════════════════════════
   HEADER ANIMATIONS
   ═══════════════════════════════════════════════════════════ */

export const headerVariants: Variants = {
    initial: {
        opacity: 0,
        y: -20,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: transitions.spring,
    },
};

export const phaseIconVariants: Variants = {
    initial: { scale: 0, rotate: -180 },
    animate: {
        scale: 1,
        rotate: 0,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 20,
        },
    },
    hover: {
        scale: 1.1,
        rotate: 10,
        transition: transitions.fast,
    },
};

/* ═══════════════════════════════════════════════════════════
   GLITCH TEXT ANIMATION
   ═══════════════════════════════════════════════════════════ */

export const glitchTextVariants: Variants = {
    animate: {
        x: [0, -2, 2, -2, 2, 0],
        textShadow: [
            '2px 0 var(--neon-cyan), -2px 0 var(--neon-magenta)',
            '-2px 0 var(--neon-cyan), 2px 0 var(--neon-magenta)',
            '2px 0 var(--neon-cyan), -2px 0 var(--neon-magenta)',
        ],
        transition: {
            duration: 0.3,
            repeat: Infinity,
            repeatDelay: 2,
        },
    },
};

/* ═══════════════════════════════════════════════════════════
   CONFETTI ANIMATION
   ═══════════════════════════════════════════════════════════ */

export const confettiVariants: Variants = {
    initial: {
        y: -100,
        opacity: 1,
        rotate: 0,
    },
    animate: (i: number) => ({
        y: '100vh',
        opacity: 0,
        rotate: Math.random() * 720 - 360,
        transition: {
            duration: 2 + Math.random() * 2,
            delay: i * 0.05,
            ease: 'linear',
        },
    }),
};