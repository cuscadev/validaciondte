export type ProductTourStatus = 'pending' | 'completed' | 'dismissed';

const STORAGE_PREFIX = 'kaydte-product-tour';
const AWAITING_SUFFIX = ':awaiting-results';

function storageKey(userId: string, tourId: string) {
  return `${STORAGE_PREFIX}:${userId}:${tourId}`;
}

function awaitingKey(userId: string, tourId: string) {
  return `${storageKey(userId, tourId)}${AWAITING_SUFFIX}`;
}

export function getProductTourStatus(
  userId: string | null | undefined,
  tourId: string,
): ProductTourStatus {
  if (!userId || typeof window === 'undefined') return 'pending';
  const raw = window.localStorage.getItem(storageKey(userId, tourId));
  if (raw === 'completed' || raw === 'dismissed') return raw;
  return 'pending';
}

export function setProductTourStatus(
  userId: string,
  tourId: string,
  status: Exclude<ProductTourStatus, 'pending'>,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userId, tourId), status);
}

export function resetProductTourStatus(userId: string, tourId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(userId, tourId));
  clearTourAwaitingResults(userId, tourId);
}

export function setTourAwaitingResults(userId: string, tourId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(awaitingKey(userId, tourId), '1');
}

export function isTourAwaitingResults(
  userId: string | null | undefined,
  tourId: string,
): boolean {
  if (!userId || typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(awaitingKey(userId, tourId)) === '1';
}

export function clearTourAwaitingResults(userId: string, tourId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(awaitingKey(userId, tourId));
}
