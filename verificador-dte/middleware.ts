import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { isCollaboratorInviteToken } from './lib/app-url';
import { isPublicPath } from './lib/publicRoutes';

const INVITE_TOKEN_MISROUTED_PATHS = new Set(['/signup', '/register', '/login']);

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Firebase public keys in JWK format — works in Edge runtime
const JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (INVITE_TOKEN_MISROUTED_PATHS.has(pathname)) {
    const token = req.nextUrl.searchParams.get('token');
    if (isCollaboratorInviteToken(token)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/invitacion-colaborador';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Skip API routes (they have their own auth checks) and public pages
  if (pathname.startsWith('/api/') || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('__session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return NextResponse.next();
  } catch {
    // Token expired or invalid — clear cookie and redirect
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('__session');
    return response;
  }
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
