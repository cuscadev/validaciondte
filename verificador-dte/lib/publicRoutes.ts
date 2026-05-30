export const PUBLIC_ROUTES = [
  '/',
  '/landing',
  '/login',
  '/signup',
  '/mfa-login',
  '/mfa-setup',
  '/totp-verify',
  '/register',
  '/reset-password',
  '/invitacion-colaborador',
  '/verificacion-dte',
  '/facturacion-electronica',
  '/consulta-hacienda',
  '/auditoria-dte',
  '/precios',
];

export function isPublicPath(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
