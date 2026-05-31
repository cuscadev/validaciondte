'use client';

import { Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UploadTableFilterButtonProps = {
  onClick: () => void;
  activeCount?: number;
  className?: string;
};

export default function UploadTableFilterButton({
  onClick,
  activeCount = 0,
  className,
}: UploadTableFilterButtonProps) {
  const hasActive = activeCount > 0;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('relative h-9 shrink-0 gap-1.5 px-3', className)}
      onClick={onClick}
      aria-label="Filtrar"
      title="Filtrar"
    >
      <Filter className="size-4 shrink-0" aria-hidden />
      <span>Filtrar</span>
      {hasActive && (
        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {activeCount > 9 ? '9+' : activeCount}
        </span>
      )}
    </Button>
  );
}
