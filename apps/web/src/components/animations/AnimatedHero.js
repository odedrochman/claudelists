'use client';

import { motion, useReducedMotion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function AnimatedHero({ children, className = '' }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial={shouldReduceMotion ? 'visible' : 'hidden'}
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedHeroItem({ children, className = '' }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
