'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';

import 'react-day-picker/style.css';

type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      animate
      navLayout="around"
      showOutsideDays
      className={cn('rdp-root bg-background p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'flex flex-col gap-3',
        month_caption: 'flex items-center justify-center gap-1',
        caption_label: 'text-sm font-semibold capitalize',
        nav: 'flex items-center gap-1',
        button_previous:
          'inline-flex size-8 items-center justify-center rounded-md border border-border bg-background hover:bg-muted',
        button_next:
          'inline-flex size-8 items-center justify-center rounded-md border border-border bg-background hover:bg-muted',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-xs font-medium text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative p-0 text-center',
        day_button:
          'inline-flex size-9 items-center justify-center rounded-md text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-40',
      }}
      {...props}
    />
  );
}
