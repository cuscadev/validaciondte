'use client';

import { useEffect, useId, useLayoutEffect, useState, type RefObject } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COMET_LAPS = 2;
const COMET_DURATION = 3.6;
const COMET_SEGMENT = 0.12;
const TRAVEL_RATIO = 0.88;
const BORDER_RADIUS = 8;
const STROKE_WIDTH = 2;

type UploadAccordionBorderCometProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  onComplete: () => void;
};

function buildRoundedRectPath(w: number, h: number, r: number, inset: number) {
  const x = inset;
  const y = inset;
  const iw = w - inset * 2;
  const ih = h - inset * 2;

  return [
    `M ${x + r},${y}`,
    `L ${x + iw - r},${y}`,
    `Q ${x + iw},${y} ${x + iw},${y + r}`,
    `L ${x + iw},${y + ih - r}`,
    `Q ${x + iw},${y + ih} ${x + iw - r},${y + ih}`,
    `L ${x + r},${y + ih}`,
    `Q ${x},${y + ih} ${x},${y + ih - r}`,
    `L ${x},${y + r}`,
    `Q ${x},${y} ${x + r},${y}`,
  ].join(' ');
}

export default function UploadAccordionBorderComet({
  containerRef,
  onComplete,
}: UploadAccordionBorderCometProps) {
  const prefersReducedMotion = useReducedMotion();
  const gradientId = useId().replace(/:/g, '');
  const glowId = `${gradientId}-glow`;
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      setSize({ width, height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete();
    }
  }, [prefersReducedMotion, onComplete]);

  if (prefersReducedMotion || size.width === 0 || size.height === 0) {
    return null;
  }

  const inset = STROKE_WIDTH / 2;
  const pathD = buildRoundedRectPath(size.width, size.height, BORDER_RADIUS, inset);
  const travelDuration = COMET_DURATION * TRAVEL_RATIO;
  const fadeDuration = COMET_DURATION * (1 - TRAVEL_RATIO);

  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={inset}
          y1={inset}
          x2={size.width - inset}
          y2={inset}
        >
          <stop offset="0%" stopColor="rgb(250 204 21)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(253 224 71)" stopOpacity="1" />
        </linearGradient>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <motion.path
        d={pathD}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${COMET_SEGMENT} ${1 - COMET_SEGMENT}`}
        initial={{ strokeDashoffset: COMET_LAPS, opacity: 1 }}
        animate={{ strokeDashoffset: 0, opacity: 0 }}
        transition={{
          strokeDashoffset: {
            duration: travelDuration,
            ease: 'linear',
          },
          opacity: {
            delay: travelDuration,
            duration: fadeDuration,
            ease: 'easeOut',
          },
        }}
        filter={`url(#${glowId})`}
        onAnimationComplete={onComplete}
      />
    </svg>
  );
}
