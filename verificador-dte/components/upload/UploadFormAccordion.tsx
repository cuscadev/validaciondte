'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import UploadAccordionBorderComet from '@/components/upload/UploadAccordionBorderComet';
import UploadProcessingPanel from '@/components/upload/UploadProcessingPanel';
import {
  Collapsible,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { DteProcessingStats } from '@/lib/upload-dte-stats';
import { cn } from '@/lib/utils';

const ENTRANCE_OPEN_DURATION = 1.1;
const OPEN_DURATION = 0.55;
const CLOSE_DURATION = 0.5;
const PROCESSING_FOOTER_MIN_H = 'min-h-[11.5rem]';

const containerBorderClass =
  'border border-yellow-200 dark:border-yellow-400/30';

type ProcessingPhase = 'idle' | 'loading';
type SummaryDisplay = 'none' | 'full';

export type UploadFormAccordionContextValue = {
  setProcessing: (value: boolean) => void;
  setProcessingSummary: (stats: DteProcessingStats) => void;
};

export const UploadFormAccordionContext =
  createContext<UploadFormAccordionContextValue | null>(null);

export function useUploadFormAccordion() {
  return useContext(UploadFormAccordionContext);
}

export type UploadFormAccordionProps = {
  title?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapseWhenResults?: boolean;
  hasResults?: boolean;
  accordionApiRef?: React.MutableRefObject<UploadFormAccordionContextValue | null>;
  onResultsReveal?: () => void;
  children: ReactNode;
  className?: string;
};

export default function UploadFormAccordion({
  title = 'Subir archivos',
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  collapseWhenResults = false,
  hasResults = false,
  accordionApiRef,
  onResultsReveal,
  children,
  className,
}: UploadFormAccordionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [summaryDisplay, setSummaryDisplay] = useState<SummaryDisplay>('none');
  const [processingStats, setProcessingStats] = useState<DteProcessingStats | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [showComet, setShowComet] = useState(false);
  const hadResultsRef = useRef(false);
  const isEntranceOpenRef = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const prefersReducedMotion = useReducedMotion();
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const setProcessing = useCallback(
    (value: boolean) => {
      if (value) {
        setProcessingStats(null);
        setSummaryDisplay('none');
        setProcessingPhase('loading');
        setOpen(false);
        return;
      }

      setProcessingPhase('idle');
    },
    [setOpen]
  );

  const setProcessingSummary = useCallback(
    (stats: DteProcessingStats) => {
      setProcessingStats(stats);
      setSummaryDisplay('full');
      setProcessingPhase('idle');
      onResultsReveal?.();
    },
    [onResultsReveal]
  );

  const contextValue = useMemo(
    () => ({ setProcessing, setProcessingSummary }),
    [setProcessing, setProcessingSummary]
  );

  useEffect(() => {
    if (!accordionApiRef) return;
    accordionApiRef.current = contextValue;
    return () => {
      accordionApiRef.current = null;
    };
  }, [accordionApiRef, contextValue]);

  const measureContentHeight = () => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  };

  useLayoutEffect(() => {
    measureContentHeight();
  }, [children, open]);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      measureContentHeight();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!isControlled) {
        setInternalOpen(true);
      }
      onOpenChange?.(true);
    });
    return () => cancelAnimationFrame(frame);
    // Entrance animation only on mount (component remounts on route change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!collapseWhenResults) return;
    if (hasResults && !hadResultsRef.current) {
      if (!isControlled) setInternalOpen(false);
      onOpenChange?.(false);
    }
    hadResultsRef.current = hasResults;
  }, [collapseWhenResults, hasResults, isControlled, onOpenChange]);

  const handleOpenComplete = () => {
    if (!open || !isEntranceOpenRef.current) return;

    isEntranceOpenRef.current = false;

    if (!prefersReducedMotion) {
      setShowComet(true);
    }
  };

  const handleCometComplete = useCallback(() => {
    setShowComet(false);
  }, []);

  const duration = prefersReducedMotion
    ? 0
    : open
      ? isEntranceOpenRef.current
        ? ENTRANCE_OPEN_DURATION
        : OPEN_DURATION
      : CLOSE_DURATION;

  const showSummaryCards =
    processingStats !== null && summaryDisplay === 'full';
  const showProcessingPanel = processingPhase === 'loading' || showSummaryCards;
  const hasExpandedFooter = open || showProcessingPanel;
  const triggerRoundedClass = hasExpandedFooter ? 'rounded-t-lg' : 'rounded-lg';

  return (
    <UploadFormAccordionContext.Provider value={contextValue}>
      <Collapsible open={open} onOpenChange={setOpen} className={className}>
        <div
          ref={containerRef}
          className={cn('relative overflow-hidden rounded-lg', containerBorderClass)}
        >
          {showComet && (
            <UploadAccordionBorderComet
              containerRef={containerRef}
              onComplete={handleCometComplete}
            />
          )}

          <CollapsibleTrigger
            type="button"
            aria-controls={contentId}
            className={cn(
              'flex w-full items-center justify-between bg-slate-50 px-4 py-2.5 text-sm font-medium',
              'transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/40',
              'dark:bg-black dark:hover:bg-zinc-900',
              triggerRoundedClass
            )}
          >
            <span className="font-bold text-yellow-400 dark:text-yellow-400">{title}</span>
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-yellow-400/70 transition-transform duration-[1100ms] ease-in-out',
                open && 'rotate-180'
              )}
            />
          </CollapsibleTrigger>

          <motion.div
            id={contentId}
            role="region"
            aria-hidden={!open}
            initial={false}
            animate={{
              height: open ? contentHeight : 0,
              opacity: open ? 1 : 0,
            }}
            transition={{
              duration,
              ease: [0.4, 0, 0.2, 1],
            }}
            onAnimationComplete={() => {
              if (open) handleOpenComplete();
            }}
            className={cn(
              'overflow-hidden bg-slate-50 dark:bg-black',
              open && !showProcessingPanel ? 'rounded-b-lg' : '',
              !open && 'pointer-events-none'
            )}
          >
            <div ref={contentRef} className="space-y-3 p-4 pt-3">
              {children}
            </div>
          </motion.div>

          {showProcessingPanel && (
            <div
              className={cn(
                'flex items-center justify-center rounded-b-lg border-t border-yellow-200/80 bg-slate-50 px-4 py-4 dark:border-yellow-400/20 dark:bg-black',
                PROCESSING_FOOTER_MIN_H
              )}
            >
              <UploadProcessingPanel
                phase={showSummaryCards ? 'summary' : 'loading'}
                stats={processingStats}
                density="full"
                className="w-full"
              />
            </div>
          )}
        </div>
      </Collapsible>
    </UploadFormAccordionContext.Provider>
  );
}
