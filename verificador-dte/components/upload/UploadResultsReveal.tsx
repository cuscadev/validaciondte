'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type UploadResultsRevealProps = {
  visible: boolean;
  children: ReactNode;
  className?: string;
};

export default function UploadResultsReveal({
  visible,
  children,
  className,
}: UploadResultsRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="upload-results"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
          }
          className={cn('space-y-4', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
