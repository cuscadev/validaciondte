'use client';

import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type HelpTooltipProps = {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  contentClassName?: string;
};

export default function HelpTooltip({
  content,
  side = 'top',
  className,
  contentClassName,
}: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-6 shrink-0 text-muted-foreground hover:text-foreground', className)}
          aria-label="Mas informacion"
        >
          <CircleHelp className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} className={cn('max-w-sm text-left font-normal', contentClassName)}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
