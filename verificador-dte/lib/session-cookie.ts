/** Cookie de sesion para middleware. Lax permite volver de OAuth (Google) sin perder sesion. */
export const SESSION_COOKIE_NAME = '__session';
export const SESSION_COOKIE_MAX_AGE = 3600;

export function setSessionCookie(token: string) {
  document.cookie = `${SESSION_COOKIE_NAME}=${token}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
