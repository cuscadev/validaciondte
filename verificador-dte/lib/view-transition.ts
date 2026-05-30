export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function runViewTransition(update: () => void): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) {
    update();
    return;
  }
  const startTransition = (
    document as Document & { startViewTransition?: (cb: () => void) => void }
  ).startViewTransition;
  if (typeof startTransition === 'function') {
    startTransition.call(document, update);
    return;
  }
  update();
}
