'use client';

import { motion, useReducedMotion } from 'framer-motion';

export default function HoverLift({
  children,
  className = '',
  scale = 1.02,
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      whileHover={{
        y: -2,
        scale,
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
}
