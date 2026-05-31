'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { dateToDmy, dmyToDate } from '@/lib/dte-fecha-input';
import {
  addMonths,
  buildMonthGrid,
  buildYearPage,
  buildYearPageStart,
  canGoNextYearPage,
  canGoPrevYearPage,
  formatMonthLabel,
  formatMonthShort,
  formatYearRange,
  getWeekdayLabels,
  isSameDay,
  isSameMonth,
  monthIndexList,
  nextYearPageStart,
  prevYearPageStart,
  setMonth,
  setYear,
  startOfMonth,
} from '@/lib/dte-calendar-grid';
import { cn } from '@/lib/utils';

type PickerView = 'days' | 'months' | 'years';

type FechaEmiDatePickerProps = {
  value: string;
  onSelect: (dmy: string) => void;
  onClose?: () => void;
  resetKey?: string | number;
};

const SELECT_DELAY_MS = 180;

export default function FechaEmiDatePicker({
  value,
  onSelect,
  onClose,
  resetKey,
}: FechaEmiDatePickerProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const today = useMemo(() => new Date(), []);
  const selected = useMemo(() => dmyToDate(value), [value]);

  const [view, setView] = useState<PickerView>('days');
  const [cursor, setCursor] = useState<Date>(() => selected ?? startOfMonth(today));
  const [direction, setDirection] = useState(1);
  const [pendingDay, setPendingDay] = useState<Date | null>(null);
  const [yearPageStart, setYearPageStart] = useState(() =>
    buildYearPageStart(selected?.getFullYear() ?? today.getFullYear())
  );

  useEffect(() => {
    const base = dmyToDate(value) ?? startOfMonth(today);
    setView('days');
    setCursor(startOfMonth(base));
    setYearPageStart(buildYearPageStart(base.getFullYear()));
    setPendingDay(null);
    setDirection(1);
  }, [resetKey, value, today]);

  const goView = (next: PickerView, dir: 1 | -1) => {
    setDirection(dir);
    setView(next);
  };

  const handleSelectDay = (day: Date) => {
    setPendingDay(day);
    window.setTimeout(() => {
      onSelect(dateToDmy(day));
      onClose?.();
    }, SELECT_DELAY_MS);
  };

  const slideVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: (d: number) => ({ opacity: 0, x: d > 0 ? 16 : -16 }),
        animate: { opacity: 1, x: 0 },
        exit: (d: number) => ({ opacity: 0, x: d > 0 ? -16 : 16 }),
      };

  const header = (() => {
    if (view === 'days') {
      return {
        onPrev: () => setCursor((c) => addMonths(c, -1)),
        onNext: () => setCursor((c) => addMonths(c, 1)),
        prevLabel: t('prrocesardte_picker_prev_month'),
        nextLabel: t('prrocesardte_picker_next_month'),
        title: formatMonthLabel(cursor),
        titleAction: () => goView('months', 1),
        titleAria: t('prrocesardte_picker_select_month'),
      };
    }
    if (view === 'months') {
      return {
        onPrev: () => setCursor((c) => setYear(c, c.getFullYear() - 1)),
        onNext: () => setCursor((c) => setYear(c, c.getFullYear() + 1)),
        prevLabel: t('prrocesardte_picker_prev_year'),
        nextLabel: t('prrocesardte_picker_next_year'),
        title: String(cursor.getFullYear()),
        titleAction: () => {
          setYearPageStart(buildYearPageStart(cursor.getFullYear()));
          goView('years', 1);
        },
        titleAria: t('prrocesardte_picker_select_year'),
      };
    }
    return {
      onPrev: () => setYearPageStart((s) => prevYearPageStart(s)),
      onNext: () => setYearPageStart((s) => nextYearPageStart(s)),
      prevLabel: t('prrocesardte_picker_prev_year'),
      nextLabel: t('prrocesardte_picker_next_year'),
      title: formatYearRange(yearPageStart),
      titleAction: undefined,
      titleAria: t('prrocesardte_picker_select_year'),
      disablePrev: !canGoPrevYearPage(yearPageStart),
      disableNext: !canGoNextYearPage(yearPageStart),
    };
  })();

  const weekdays = getWeekdayLabels();
  const monthGrid = buildMonthGrid(cursor.getFullYear(), cursor.getMonth());
  const years = buildYearPage(yearPageStart);

  return (
    <div className="w-[280px] p-2">
      <div className="flex h-10 items-center justify-between gap-1 px-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={header.onPrev}
          disabled={header.disablePrev}
          aria-label={header.prevLabel}
          title={header.prevLabel}
        >
          <ChevronLeft className="size-4" />
        </Button>

        {header.titleAction ? (
          <button
            type="button"
            onClick={header.titleAction}
            className="min-w-0 flex-1 truncate text-center text-sm font-semibold capitalize hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
            aria-label={header.titleAria}
          >
            {header.title}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
            {header.title}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={header.onNext}
          disabled={header.disableNext}
          aria-label={header.nextLabel}
          title={header.nextLabel}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {view !== 'days' && (
        <div className="mb-1 flex justify-start px-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => goView(view === 'years' ? 'months' : 'days', -1)}
          >
            {t('prrocesardte_picker_back')}
          </Button>
        </div>
      )}

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {view === 'days' && (
            <motion.div
              key="days"
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
              }
            >
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {weekdays.map((label, i) => (
                  <div
                    key={`${label}-${i}`}
                    className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {monthGrid.flat().map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="h-8" />;
                  }
                  const isSelected = selected ? isSameDay(day, selected) : false;
                  const isPending = pendingDay ? isSameDay(day, pendingDay) : false;
                  const isToday = isSameDay(day, today);
                  const isOutside = !isSameMonth(day, cursor);

                  return (
                    <motion.div key={day.toISOString()} whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!!pendingDay}
                        onClick={() => handleSelectDay(day)}
                        className={cn(
                          'h-8 w-full p-0 text-xs font-normal',
                          isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                          isPending && 'scale-95 bg-primary/90 text-primary-foreground',
                          isToday && !isSelected && 'ring-1 ring-primary/40',
                          isOutside && 'text-muted-foreground/60'
                        )}
                        aria-label={t('prrocesardte_picker_select_day', { date: dateToDmy(day) })}
                      >
                        {day.getDate()}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'months' && (
            <motion.div
              key="months"
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
              }
            >
              <div className="grid grid-cols-3 gap-1">
                {monthIndexList().map((month) => {
                  const date = new Date(cursor.getFullYear(), month, 1);
                  const isCurrent = today.getFullYear() === date.getFullYear() && today.getMonth() === month;
                  const isSelected =
                    selected?.getFullYear() === date.getFullYear() &&
                    selected.getMonth() === month;

                  return (
                    <Button
                      key={month}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-9 text-xs capitalize',
                        isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                        isCurrent && !isSelected && 'ring-1 ring-primary/30'
                      )}
                      onClick={() => {
                        setCursor(setMonth(cursor, month));
                        goView('days', -1);
                      }}
                    >
                      {formatMonthShort(date)}
                    </Button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'years' && (
            <motion.div
              key="years"
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
              }
            >
              <div className="grid grid-cols-3 gap-1">
                {years.map((year) => {
                  const isCurrent = today.getFullYear() === year;
                  const isSelected = selected?.getFullYear() === year;
                  const isCursorYear = cursor.getFullYear() === year;

                  return (
                    <Button
                      key={year}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-9 text-xs',
                        (isSelected || isCursorYear) &&
                          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                        isCurrent && !isSelected && !isCursorYear && 'ring-1 ring-primary/30'
                      )}
                      onClick={() => {
                        setCursor(setYear(cursor, year));
                        goView('months', -1);
                      }}
                    >
                      {year}
                    </Button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
