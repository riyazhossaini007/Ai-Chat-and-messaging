import type { Transition, Variants } from "motion/react";

export const optimizedMotionStyle = {
  willChange: "transform, opacity",
} as const;

export const layoutTransition: Transition = {
  duration: 0.1,
  ease: "easeOut",
};

export const messageSendVariant: Variants = {
  initial: { opacity: 0.01 },
  animate: {
    opacity: 1,
    transition: { duration: 0.08, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    transition: { duration: 0.1, ease: "easeInOut" },
  },
};

export const messageReceiveVariant: Variants = {
  initial: { opacity: 0.01 },
  animate: {
    opacity: 1,
    transition: { duration: 0.08, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    transition: { duration: 0.1, ease: "easeInOut" },
  },
};

export const hoverRevealVariant: Variants = {
  initial: { opacity: 0, x: 6 },
  hover: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.12, ease: "easeOut" },
  },
};

export const fadeScaleVariant: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.16, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.16, ease: "easeInOut" },
  },
};

export const slidePanelVariant: Variants = {
  hidden: { x: 40, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.24, ease: "easeOut" },
  },
  exit: {
    x: 40,
    opacity: 0,
    transition: { duration: 0.24, ease: "easeInOut" },
  },
};

export const typingDotVariant: Variants = {
  animate: {
    y: [0, -4, 0],
    transition: { duration: 0.36, ease: "easeInOut", repeat: Infinity },
  },
};

export const reactionPopVariant: Variants = {
  initial: { scale: 0 },
  animate: {
    scale: [0, 1.2, 1],
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.16, ease: "easeInOut" },
  },
};

export const statusPulseTransition: Transition = {
  duration: 0.6,
  ease: "easeInOut",
  repeat: Infinity,
};
