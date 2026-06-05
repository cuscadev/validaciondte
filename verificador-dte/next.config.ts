// next.config.ts
import type { NextConfig } from "next";

const goDteApiUrl =
  process.env.GO_DTE_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_GO_DTE_API_URL?.trim() ||
  'https://verificador-api-dte.cuscadev.com';

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from sniffing MIME types
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Restrict referrer info sent to other origins
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Only allow HTTPS for 2 years, include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Disable browser features not needed by this app
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Firebase Auth, Firestore, Storage, Functions
      `connect-src 'self' ${goDteApiUrl} https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://firebasestorage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://static.cloudflareinsights.com https://vercel.live https://*.vercel.live`,
      // Scripts: self + unsafe-inline needed by Next.js dev overlay; nonces are the ideal solution but require more setup
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://vercel.live https://*.vercel.live",
      "script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://vercel.live https://*.vercel.live",
      // Styles (Google Fonts CSS)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: self, Firebase Storage, data URIs
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
      // Fonts (Google Fonts files)
      "font-src 'self' data: https://fonts.gstatic.com",
      // Frames
      "frame-src 'self'",
      // Form actions only to self
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
