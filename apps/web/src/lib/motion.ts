import { type Variants, type Transition } from "framer-motion";

/* ─── Spring Configs ────────────────────────────────────────────── */
export const springs = {
  /** Bouncy — for cards, popups, badges */
  bouncy: { type: "spring", stiffness: 400, damping: 20 } as Transition,
  /** Smooth — for page transitions, sidebars */
  smooth: { type: "spring", stiffness: 300, damping: 30 } as Transition,
  /** Snappy — for toasts, dropdowns */
  snappy: { type: "spring", stiffness: 500, damping: 35 } as Transition,
  /** Gentle — for background elements */
  gentle: { type: "spring", stiffness: 150, damping: 25 } as Transition,
  /** Elastic — for buttons, press effects */
  elastic: { type: "spring", stiffness: 600, damping: 15 } as Transition,
};

/* ─── Ease Curves ───────────────────────────────────────────────── */
export const easings = {
  bounce: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
  snappy: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
};

/* ─── Base Variants ─────────────────────────────────────────────── */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: easings.smooth } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easings.smooth },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easings.smooth },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springs.bouncy,
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springs.elastic,
  },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.1 } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springs.smooth,
  },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springs.smooth,
  },
  exit: { opacity: 0, x: 24, transition: { duration: 0.2 } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.smooth,
  },
  exit: { opacity: 0, y: 16 },
};

/* ─── Stagger Container ─────────────────────────────────────────── */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.smooth,
  },
};

export const staggerItemPop: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springs.bouncy,
  },
};

/* ─── Page Transitions ──────────────────────────────────────────── */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easings.smooth },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: easings.smooth },
  },
};

/* ─── Sidebar Variants ──────────────────────────────────────────── */
export const sidebarVariants: Variants = {
  expanded: { width: 260, transition: springs.smooth },
  collapsed: { width: 72, transition: springs.smooth },
};

export const sidebarLabelVariants: Variants = {
  expanded: {
    opacity: 1,
    x: 0,
    display: "block",
    transition: { delay: 0.1, duration: 0.2 },
  },
  collapsed: {
    opacity: 0,
    x: -8,
    transitionEnd: { display: "none" },
    transition: { duration: 0.15 },
  },
};

/* ─── Modal / Dialog ────────────────────────────────────────────── */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springs.bouncy },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15 } },
};

export const drawerVariants = {
  right: {
    hidden: { x: "100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: springs.smooth },
    exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
  },
  left: {
    hidden: { x: "-100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: springs.smooth },
    exit: { x: "-100%", opacity: 0, transition: { duration: 0.2 } },
  },
  bottom: {
    hidden: { y: "100%", opacity: 0 },
    visible: { y: 0, opacity: 1, transition: springs.smooth },
    exit: { y: "100%", opacity: 0, transition: { duration: 0.2 } },
  },
};

/* ─── Dropdown / Popover ────────────────────────────────────────── */
export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -6,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: springs.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    filter: "blur(2px)",
    transition: { duration: 0.12 },
  },
};

export const tooltipVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } },
};

/* ─── Toast ─────────────────────────────────────────────────────── */
export const toastVariants: Variants = {
  hidden: { opacity: 0, x: 60, scale: 0.9 },
  visible: { opacity: 1, x: 0, scale: 1, transition: springs.snappy },
  exit: { opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } },
};

/* ─── Hover / Gesture Configs ───────────────────────────────────── */
export const hoverLift = {
  whileHover: { y: -3, transition: springs.bouncy },
  whileTap: { y: 1, transition: springs.elastic },
};

export const hoverScale = {
  whileHover: { scale: 1.03, transition: springs.bouncy },
  whileTap: { scale: 0.97, transition: springs.elastic },
};

export const hoverWiggle = {
  whileHover: { rotate: [0, 3, -3, 0], transition: { duration: 0.4 } },
};

export const hoverPop = {
  whileHover: {
    scale: 1.05,
    rotate: -1,
    transition: springs.bouncy,
  },
  whileTap: {
    scale: 0.95,
    rotate: 0,
    transition: springs.elastic,
  },
};

/** Button press — like a physical button */
export const buttonPress = {
  whileHover: {
    y: -2,
    boxShadow: "6px 6px 0px 0px #1e293b",
    transition: springs.bouncy,
  },
  whileTap: {
    y: 2,
    boxShadow: "2px 2px 0px 0px #1e293b",
    transition: springs.elastic,
  },
};

/* ─── Chart Entrance ────────────────────────────────────────────── */
export const chartBarEntrance = (delay = 0): Variants => ({
  hidden: { scaleY: 0, originY: 1 },
  visible: {
    scaleY: 1,
    transition: { ...springs.bouncy, delay },
  },
});

export const chartLineEntrance: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.2, ease: easings.smooth },
  },
};

/* ─── AI Processing ─────────────────────────────────────────────── */
export const aiPulse: Variants = {
  idle: { scale: 1, opacity: 0.8 },
  processing: {
    scale: [1, 1.08, 1],
    opacity: [0.8, 1, 0.8],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
};

export const aiOrbit: Variants = {
  animate: {
    rotate: 360,
    transition: { duration: 8, repeat: Infinity, ease: "linear" },
  },
};

/* ─── Number Counter ────────────────────────────────────────────── */
export const counterVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, ...springs.smooth },
  }),
};

/* ─── Particle Float ────────────────────────────────────────────── */
export const particleVariants = (delay: number, duration: number): Variants => ({
  animate: {
    y: [-10, 10, -10],
    x: [-5, 5, -5],
    opacity: [0.4, 0.8, 0.4],
    scale: [0.9, 1.1, 0.9],
    transition: {
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
});
