import { NextResponse } from 'next/server';
import { mobileAppDownloadUrl } from '@/lib/mobile-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.redirect(mobileAppDownloadUrl, 302);
}
