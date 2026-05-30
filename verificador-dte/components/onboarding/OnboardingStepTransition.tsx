'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type OnboardingStepTransitionProps = {
  stepKey: string;
  children: ReactNode;
  className?: string;
};

export function OnboardingStepTransition({
  stepKey,
  children,
  className,
}: OnboardingStepTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const duration = prefersReducedMotion ? 0 : 0.3;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
        transition={{ duration, ease: 'easeOut' }}
        className={className}
        style={{ viewTransitionName: 'onboarding-step' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
