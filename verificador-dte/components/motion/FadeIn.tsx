'use client';

import { motion, type HTMLMotionProps, type Transition } from 'framer-motion';

type FadeInElement = 'motion.div' | 'div' | 'article';

export type FadeInProps = {
  as?: FadeInElement;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
  inView?: boolean;
  viewportAmount?: number;
  transition?: Transition;
} & Omit<HTMLMotionProps<'div'>, 'children'>;

export function FadeIn({
  as = 'div',
  children,
  className,
  delay = 0,
  y = 32,
  duration = 0.7,
  inView = false,
  viewportAmount = 0.4,
  transition,
  ...rest
}: FadeInProps) {
  const Component = as === 'article' ? motion.article : motion.div;

  const baseTransition: Transition = {
    delay,
    duration,
    ease: 'easeOut',
    ...transition,
  };

  const motionProps = inView
    ? {
        initial: { opacity: 0, y },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: viewportAmount },
      }
    : {
        initial: { opacity: 0, y },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <Component
      className={className}
      transition={baseTransition}
      {...motionProps}
      {...rest}
    >
      {children}
    </Component>
  );
}
