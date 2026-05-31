'use client';

import { useEffect, useRef, useState } from 'react';

const RGB_NAME_MIN_MS = 2000;

export function useRgbNameReveal(chartsLoading: boolean) {
  const mountAt = useRef(Date.now());
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (chartsLoading) {
      setRevealed(false);
      return;
    }

    const loadDuration = Date.now() - mountAt.current;
    const totalDuration = Math.max(RGB_NAME_MIN_MS, loadDuration);
    const remaining = Math.max(0, mountAt.current + totalDuration - Date.now());

    const timer = window.setTimeout(() => setRevealed(true), remaining);
    return () => window.clearTimeout(timer);
  }, [chartsLoading]);

  return revealed;
}
