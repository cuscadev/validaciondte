'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type UploadTableHintsProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export default function UploadTableHints({
  title = 'Indicaciones para revisar la tabla',
  children,
  className,
}: UploadTableHintsProps) {
  return (
    <section
      className={cn(
        'flex h-full flex-col rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-foreground shadow-sm',
        className
      )}
    >
      <h2 className="text-xs font-semibold text-primary">{title}</h2>
      <div className="mt-1.5 text-xs leading-snug text-muted-foreground">{children}</div>
    </section>
  );
}
