'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import FechaEmiDatePicker from '@/components/dte/FechaEmiDatePicker';
import { Button } from '@/components/ui/button';
import { formatFechaInput } from '@/lib/dte-fecha-input';
import { cn } from '@/lib/utils';

type FechaEmiInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const POPOVER_WIDTH = 300;

export default function FechaEmiInput({
  value,
  onChange,
  placeholder,
  className,
}: FechaEmiInputProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pickerSession, setPickerSession] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - POPOVER_WIDTH),
      window.innerWidth - POPOVER_WIDTH - 8
    );
    const top = rect.bottom + 6;

    setPosition({ top, left });
  }, []);

  const openCalendar = () => {
    updatePosition();
    setPickerSession((s) => s + 1);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onReposition = () => updatePosition();

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  const popover =
    open && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            style={{
              top: position.top,
              left: position.left,
              width: POPOVER_WIDTH,
            }}
            className="fixed z-[200] rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
            role="dialog"
            aria-label={t('prrocesardte_tooltip_calendario')}
          >
            <FechaEmiDatePicker
              resetKey={pickerSession}
              value={value}
              onSelect={onChange}
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="flex items-center justify-center gap-0.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(formatFechaInput(e.target.value))}
          placeholder={placeholder}
          inputMode="numeric"
          className="w-full min-w-[6.5rem] bg-transparent px-1 py-1 text-center text-sm focus:outline-none"
        />
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'size-7 shrink-0 text-muted-foreground hover:text-foreground',
            open && 'bg-muted text-foreground'
          )}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          aria-label={t('prrocesardte_tooltip_calendario')}
          aria-expanded={open}
          title={t('prrocesardte_tooltip_calendario')}
        >
          <CalendarIcon className="size-4" />
        </Button>
      </div>
      {popover}
    </div>
  );
}
