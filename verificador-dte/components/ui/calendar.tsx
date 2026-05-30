'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar: wrapper sencillo sobre react-day-picker que acepta TODAS sus props.
 * Así puedes usar: mode="single" | "multiple" | "range", selected, onSelect, etc.
 */
export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={['p-2 rounded-md border bg-white dark:bg-neutral-950', className].filter(Boolean).join(' ')}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'space-y-2',
        caption: 'flex justify-center items-center pt-1',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        head_row: 'flex',
        head_cell: 'w-9 text-center text-xs text-muted-foreground',
        row: 'flex w-full mt-1',
        cell: 'w-9 h-9 relative',
        day: 'w-9 h-9 inline-flex items-center justify-center rounded-md text-sm hover:bg-muted',
        day_selected: 'bg-primary text-primary-foreground hover:bg-primary/90',
        day_today: 'outline outline-1 outline-primary/40',
      }}
      {...props}
    />
  );
}
