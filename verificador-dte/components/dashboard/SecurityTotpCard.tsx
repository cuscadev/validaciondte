'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, ShieldPlus } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SecurityTotpCardProps = {
  totpEnabled: boolean;
  variant?: 'default' | 'compact';
  className?: string;
};

export function SecurityTotpCard({
  totpEnabled,
  variant = 'default',
  className,
}: SecurityTotpCardProps) {
  const isCompact = variant === 'compact';

  return (
    <FadeIn delay={0.14} className={cn('h-full', className)}>
      <Card
        data-tour="dashboard-mfa"
        className={cn(
          'h-full border-border/60 py-0 shadow-sm',
          totpEnabled
            ? 'bg-emerald-500/5 dark:bg-emerald-500/10'
            : 'bg-muted/10'
        )}
      >
        <CardContent
          className={cn('flex h-full flex-col', isCompact ? 'p-4' : 'p-5')}
        >
          <div
            className={cn(
              'flex items-center justify-center rounded-xl',
              isCompact ? 'size-10' : 'size-12',
              totpEnabled
                ? 'bg-emerald-500 text-white'
                : 'bg-primary text-black'
            )}
          >
            {totpEnabled ? (
              <ShieldCheck className={isCompact ? 'size-5' : 'size-6'} />
            ) : (
              <ShieldPlus className={isCompact ? 'size-5' : 'size-6'} />
            )}
          </div>

          <h2
            className={cn(
              'font-bold',
              isCompact ? 'mt-3 text-lg' : 'mt-5 text-xl md:text-2xl'
            )}
          >
            {totpEnabled ? 'Tu cuenta esta protegida' : 'Activa TOTP'}
          </h2>

          <p
            className={cn(
              'mt-2 flex-1 text-muted-foreground',
              isCompact ? 'text-xs leading-5' : 'mt-3 text-sm leading-6'
            )}
          >
            {totpEnabled
              ? 'Verificacion en dos pasos activa. Gestiona la configuracion desde tu perfil.'
              : 'Agrega un segundo factor para proteger el acceso a tus validaciones.'}
          </p>

          <Link
            href="/profile"
            className={cn(
              'mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition',
              isCompact ? 'mt-4' : 'mt-6',
              totpEnabled
                ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200'
                : 'bg-primary text-black hover:bg-primary/90'
            )}
          >
            {totpEnabled ? 'Gestionar seguridad' : 'Activar TOTP'}
            <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
