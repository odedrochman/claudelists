'use client';

import { motion, useReducedMotion } from 'framer-motion';

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

export function StaggerContainer({
  children,
  className = '',
  stagger = 0.08,
  once = true,
  amount = 0.1,
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: shouldReduceMotion ? 0 : stagger } },
      }}
      initial={shouldReduceMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once, amount }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
