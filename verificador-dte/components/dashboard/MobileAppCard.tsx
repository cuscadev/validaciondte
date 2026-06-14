'use client';

import { ArrowRight, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent } from '@/components/ui/card';
import { mobileAppDownloadUrl, mobileAppQrUrl } from '@/lib/mobile-app';
import { cn } from '@/lib/utils';

type MobileAppCardProps = {
  variant?: 'default' | 'compact';
  className?: string;
};

export function MobileAppCard({ variant = 'default', className }: MobileAppCardProps) {
  const isCompact = variant === 'compact';
  const qrSize = isCompact ? 154 : 220;

  return (
    <FadeIn delay={0.2} className={cn('h-full', className)}>
      <Card className="h-full border-border/60 bg-muted/10 py-0 shadow-sm">
        <CardContent
          className={cn('flex h-full flex-col', isCompact ? 'p-4' : 'p-5')}
        >
          <div
            className={cn(
              'flex items-center justify-center rounded-xl bg-primary text-black',
              isCompact ? 'size-10' : 'size-12'
            )}
          >
            <Download className={isCompact ? 'size-5' : 'size-6'} />
          </div>

          <h2
            className={cn(
              'font-bold',
              isCompact ? 'mt-3 text-lg' : 'mt-5 text-xl md:text-2xl'
            )}
          >
            Descarga la app
          </h2>

          <p
            className={cn(
              'text-muted-foreground',
              isCompact ? 'mt-1.5 text-xs leading-5' : 'mt-3 text-sm leading-6'
            )}
          >
            Escanea el QR para KaiserQRmobile en Android.
          </p>

          <div
            className={cn(
              'flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 shadow-inner',
              isCompact ? 'mt-3 p-3' : 'mt-5 p-5'
            )}
          >
            <div className="rounded-lg bg-white p-3">
              <QRCodeCanvas
                value={mobileAppQrUrl}
                size={qrSize}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                marginSize={2}
              />
            </div>
          </div>

          <a
            href={mobileAppDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-black transition hover:bg-primary/90',
              isCompact ? 'mt-3' : 'mt-5'
            )}
          >
            Descargar APK
            <ArrowRight className="size-4" />
          </a>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

export { mobileAppDownloadUrl };
