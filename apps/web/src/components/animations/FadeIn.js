'use client';

import { motion, useReducedMotion } from 'framer-motion';

export default function FadeIn({
  children,
  className = '',
  delay = 0,
  duration = 0.5,
  y = 20,
  once = true,
  amount = 0.2,
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
