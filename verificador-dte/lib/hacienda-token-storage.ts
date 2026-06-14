const HACIENDA_TOKEN_PREFIX = 'haciendaToken';

type HaciendaEnvironment = 'test' | 'production';

function storageKey(environment: HaciendaEnvironment) {
  return `${HACIENDA_TOKEN_PREFIX}:${environment}`;
}

export function normalizeHaciendaBrowserToken(token?: string | null) {
  return String(token || '').replace(/^Bearer\s+/i, '').trim();
}

export function saveHaciendaBrowserToken(token: string, environment: HaciendaEnvironment) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeHaciendaBrowserToken(token);
  if (!normalized) return;
  window.localStorage.setItem(storageKey(environment), normalized);
}

export function getHaciendaBrowserToken(environment: HaciendaEnvironment) {
  if (typeof window === 'undefined') return '';
  return normalizeHaciendaBrowserToken(window.localStorage.getItem(storageKey(environment)));
}
