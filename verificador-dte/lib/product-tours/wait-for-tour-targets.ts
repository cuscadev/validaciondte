import type { DriveStep } from 'driver.js';

function getSelector(step: DriveStep): string | null {
  const element = step.element;
  if (typeof element === 'string') return element;
  return null;
}

export function waitForTourTargets(
  steps: DriveStep[],
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  const selectors = steps.map(getSelector).filter((selector): selector is string => Boolean(selector));

  if (selectors.length === 0) {
    return Promise.resolve(true);
  }

  const timeoutMs = options?.timeoutMs ?? 25000;
  const intervalMs = options?.intervalMs ?? 250;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    function check() {
      const ready = selectors.every((selector) => Boolean(document.querySelector(selector)));
      if (ready) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(check, intervalMs);
    }

    check();
  });
}
