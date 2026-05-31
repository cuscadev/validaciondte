'use client';

import { ArrowRight, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const mobileAppDownloadUrl =
  'https://firebasestorage.googleapis.com/v0/b/kaydte-48e8a.firebasestorage.app/o/apk%2Fapplication-0af9fda5-d65b-4692-98b3-4edc93a63a9a.apk?alt=media';

type MobileAppCardProps = {
  variant?: 'default' | 'compact';
  className?: string;
};

export function MobileAppCard({ variant = 'default', className }: MobileAppCardProps) {
  const isCompact = variant === 'compact';
  const qrSize = isCompact ? 128 : 180;

  return (
    <FadeIn delay={0.2} className={cn('h-full', className)}>
      <Card className="h-full border-border/60 bg-muted/10 py-0 shadow-sm dark:bg-zinc-950">
        <CardContent
          className={cn('flex h-full flex-col', isCompact ? 'p-4' : 'p-5')}
        >
          <div
            className={cn(
              'flex items-center justify-center rounded-xl bg-yellow-400 text-black',
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
              'text-slate-600 dark:text-zinc-300',
              isCompact ? 'mt-1.5 text-xs leading-5' : 'mt-3 text-sm leading-6'
            )}
          >
            Escanea el QR para KaiserQRmobile en Android.
          </p>

          <div
            className={cn(
              'flex min-h-0 flex-1 items-center justify-center rounded-xl bg-white dark:bg-zinc-900',
              isCompact ? 'mt-3 p-2' : 'mt-5 p-4'
            )}
          >
            <QRCodeCanvas
              value={mobileAppDownloadUrl}
              size={qrSize}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              includeMargin
            />
          </div>

          <a
            href={mobileAppDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-md bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300',
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
