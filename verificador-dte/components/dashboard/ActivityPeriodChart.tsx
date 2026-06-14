'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, RefreshCw } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityPeriodPoint, DashboardModuleStat } from '@/lib/dashboard-stats';
import { computeErrorRate } from '@/lib/dashboard-stats';
import { cn } from '@/lib/utils';

type ActivityPeriod = 'day' | 'week' | 'month';

type ActivityPeriodChartProps = {
  daily: ActivityPeriodPoint[];
  weekly: ActivityPeriodPoint[];
  monthly: ActivityPeriodPoint[];
  byModule?: DashboardModuleStat[];
  loading?: boolean;
  emptyHref?: string;
  className?: string;
  onRefresh?: () => void;
  isRefetching?: boolean;
};

const PERIOD_TABS: { id: ActivityPeriod; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
];

function hasOutcomeActivity(points: ActivityPeriodPoint[]) {
  return points.some((point) => point.successCount > 0 || point.errorCount > 0);
}

function getNiceMax(value: number) {
  if (value <= 1) return 1;
  if (value <= 4) return 4;
  if (value <= 5) return 5;
  if (value <= 10) return 10;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceNormalized * magnitude;
}

function buildYTicks(maxValue: number) {
  const max = getNiceMax(maxValue);
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max / 4;
  const ticks: number[] = [];

  for (let value = 0; value <= max; value += step) {
    ticks.push(Math.round(value));
  }

  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max);
  }

  return ticks;
}

function shortenAxisLabel(label: string) {
  const parts = label.split(' – ');
  if (parts.length === 2) {
    return parts[0].replace(/\s+/g, '\u00a0');
  }

  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}

function buildBaselineAreaPath(
  values: number[],
  baseline: number,
  chartHeight: number,
  maxValue: number,
  plotLeft: number,
  plotRight: number,
  xForIndex: (index: number) => number
) {
  if (values.length === 0) return '';

  const toY = (value: number) => baseline - (value / maxValue) * chartHeight;

  const topPoints = values.map(
    (value, index) => `${xForIndex(index)},${toY(value)}`
  );
  const basePoints = values
    .map((_, index) => `${xForIndex(index)},${baseline}`)
    .reverse();

  return `M ${plotLeft},${baseline} L ${topPoints.join(' L ')} L ${basePoints.join(' L ')} L ${plotRight},${baseline} Z`;
}

const TOOLTIP_EST_WIDTH = 192;
const TOOLTIP_EST_HEIGHT = 132;
const TOOLTIP_GAP = 12;
const TOOLTIP_PADDING = 8;

function computeTooltipPlacement(
  anchorX: number,
  anchorY: number,
  boundsWidth: number,
  boundsHeight: number,
  tooltipWidth: number,
  tooltipHeight: number
) {
  let top = anchorY - tooltipHeight - TOOLTIP_GAP;
  if (top < TOOLTIP_PADDING) {
    top = anchorY + TOOLTIP_GAP;
  }
  if (top + tooltipHeight > boundsHeight - TOOLTIP_PADDING) {
    top = Math.max(
      TOOLTIP_PADDING,
      boundsHeight - tooltipHeight - TOOLTIP_PADDING
    );
  }

  let left = anchorX - tooltipWidth / 2;
  left = Math.max(
    TOOLTIP_PADDING,
    Math.min(left, boundsWidth - tooltipWidth - TOOLTIP_PADDING)
  );

  return { left, top };
}

function OutcomeAreaChart({ points }: { points: ActivityPeriodPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(
    null
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHoverIndex(null);
    setActiveIndex(null);
    setTooltipPos(null);
  }, [points]);

  const chart = useMemo(() => {
    const width = 720;
    const height = 200;
    const paddingLeft = 42;
    const paddingRight = 16;
    const paddingTop = 20;
    const paddingBottom = 32;
    const plotLeft = paddingLeft;
    const plotRight = width - paddingRight;
    const plotWidth = plotRight - plotLeft;
    const chartHeight = height - paddingTop - paddingBottom;
    const baseline = paddingTop + chartHeight;

    const successValues = points.map((point) => point.successCount);
    const errorValues = points.map((point) => point.errorCount);
    const rawMax = Math.max(...successValues, ...errorValues, 1);
    const maxValue = getNiceMax(rawMax);
    const yTicks = buildYTicks(rawMax);

    const xForIndex = (index: number) => {
      if (points.length <= 1) return plotLeft + plotWidth / 2;
      return plotLeft + (index / (points.length - 1)) * plotWidth;
    };

    const yForValue = (value: number) =>
      baseline - (value / maxValue) * chartHeight;

    const successPath = buildBaselineAreaPath(
      successValues,
      baseline,
      chartHeight,
      maxValue,
      plotLeft,
      plotRight,
      xForIndex
    );

    const errorPath = buildBaselineAreaPath(
      errorValues,
      baseline,
      chartHeight,
      maxValue,
      plotLeft,
      plotRight,
      xForIndex
    );

    const markers = points.map((point, index) => {
      const x = xForIndex(index);
      const ySuccess = yForValue(point.successCount);
      const yError = yForValue(point.errorCount);
      const peakY =
        point.successCount > 0 || point.errorCount > 0
          ? Math.min(
              point.successCount > 0 ? ySuccess : baseline,
              point.errorCount > 0 ? yError : baseline
            )
          : baseline;

      return {
        point,
        index,
        x,
        ySuccess,
        yError,
        peakY,
      };
    });

    return {
      width,
      height,
      paddingLeft,
      paddingTop,
      plotRight,
      plotLeft,
      baseline,
      successPath,
      errorPath,
      maxValue,
      yTicks,
      yForValue,
      xForIndex,
      markers,
    };
  }, [points]);

  const activeMarker =
    activeIndex !== null ? chart.markers[activeIndex] ?? null : null;
  const activeStats = activeMarker
    ? computeErrorRate(
        activeMarker.point.successCount,
        activeMarker.point.errorCount
      )
    : null;

  const getNearestIndex = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || chart.markers.length === 0) return null;

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;

      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = 0;
      const svgX = point.matrixTransform(ctm.inverse()).x;

      let nearest = 0;
      let minDistance = Infinity;

      for (const marker of chart.markers) {
        const distance = Math.abs(marker.x - svgX);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = marker.index;
        }
      }

      return nearest;
    },
    [chart.markers]
  );

  const updateTooltipPos = useCallback(() => {
    if (
      activeIndex === null ||
      !svgRef.current ||
      !scrollRef.current
    ) {
      setTooltipPos(null);
      return;
    }

    const marker = chart.markers[activeIndex];
    if (!marker) {
      setTooltipPos(null);
      return;
    }

    const svg = svgRef.current;
    const scrollEl = scrollRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const point = svg.createSVGPoint();
    point.x = marker.x;
    point.y = Math.min(marker.peakY + 8, chart.baseline - 4);
    const mapped = point.matrixTransform(ctm);
    const scrollRect = scrollEl.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? TOOLTIP_EST_WIDTH;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? TOOLTIP_EST_HEIGHT;

    const anchorX = mapped.x - scrollRect.left + scrollEl.scrollLeft;
    const anchorY = mapped.y - scrollRect.top + scrollEl.scrollTop;

    setTooltipPos(
      computeTooltipPlacement(
        anchorX,
        anchorY,
        scrollEl.clientWidth,
        scrollEl.clientHeight,
        tooltipWidth,
        tooltipHeight
      )
    );
  }, [activeIndex, chart.baseline, chart.markers]);

  useLayoutEffect(() => {
    updateTooltipPos();
  }, [updateTooltipPos, activeIndex]);

  useEffect(() => {
    const handleReposition = () => updateTooltipPos();
    window.addEventListener('resize', handleReposition);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(handleReposition)
        : null;
    const scrollEl = scrollRef.current;
    if (scrollEl) resizeObserver?.observe(scrollEl);
    if (svgRef.current) resizeObserver?.observe(svgRef.current);

    return () => {
      window.removeEventListener('resize', handleReposition);
      resizeObserver?.disconnect();
    };
  }, [updateTooltipPos]);

  const handlePlotMouseMove = (clientX: number) => {
    setHoverIndex(getNearestIndex(clientX));
  };

  const handlePlotClick = (clientX: number) => {
    const index = getNearestIndex(clientX);
    if (index === null) return;
    setActiveIndex((current) => (current === index ? null : index));
  };

  const previewMarker =
    hoverIndex !== null && hoverIndex !== activeIndex
      ? chart.markers[hoverIndex] ?? null
      : null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/10 p-2 pt-3">
        <div
          ref={scrollRef}
          className="relative min-h-[210px] overflow-x-auto overflow-y-hidden"
        >
        {activeMarker && activeStats && tooltipPos && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-[1] w-48 rounded-lg border border-border bg-card px-3 py-2.5 shadow-xl"
            style={{
              left: tooltipPos.left,
              top: tooltipPos.top,
            }}
          >
            <p className="text-xs font-semibold capitalize">{activeMarker.point.label}</p>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground">Exitosos</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {activeMarker.point.successCount}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground">Fallidos</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {activeMarker.point.errorCount}
                </span>
              </p>
              <p className="flex justify-between gap-3 border-t border-border/60 pt-1.5">
                <span className="text-muted-foreground">Total DTEs</span>
                <span className="font-semibold">
                  {activeMarker.point.successCount + activeMarker.point.errorCount}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground">Tasa error</span>
                <span className="font-semibold">{activeStats.errorRate}%</span>
              </p>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="min-h-[200px] w-full min-w-[320px] cursor-crosshair"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Grafico de exitosos y fallidos"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {chart.yTicks.map((tick) => {
            const y = chart.yForValue(tick);
            return (
              <g key={tick}>
                <line
                  x1={chart.plotLeft}
                  x2={chart.plotRight}
                  y1={y}
                  y2={y}
                  className="stroke-border/70"
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : '4 4'}
                />
                <text
                  x={chart.paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={chart.plotLeft}
            x2={chart.plotRight}
            y1={chart.baseline}
            y2={chart.baseline}
            className="stroke-border"
            strokeWidth={1.5}
          />

          <path
            d={chart.successPath}
            className="fill-emerald-500/35 stroke-emerald-600 dark:fill-emerald-400/25 dark:stroke-emerald-400"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={chart.errorPath}
            className="fill-red-500/20 stroke-red-600 dark:fill-red-400/15 dark:stroke-red-400"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />

          <rect
            x={chart.plotLeft}
            y={chart.paddingTop}
            width={chart.plotRight - chart.plotLeft}
            height={chart.baseline - chart.paddingTop}
            fill="transparent"
            onMouseMove={(event) => handlePlotMouseMove(event.clientX)}
            onClick={(event) => handlePlotClick(event.clientX)}
          />

          {chart.markers.map((marker) => {
            const isActive = activeIndex === marker.index;
            const isHovered = hoverIndex === marker.index;
            return (
              <g key={marker.point.key} pointerEvents="none">
                {(isActive || isHovered) && (
                  <circle
                    cx={marker.x}
                    cy={marker.peakY}
                    r={isActive ? 10 : 8}
                    className={cn(
                      isActive
                        ? 'fill-primary/25 stroke-primary'
                        : 'fill-muted-foreground/10 stroke-muted-foreground/40'
                    )}
                    strokeWidth={2}
                  />
                )}
                {marker.point.successCount > 0 && (
                  <circle
                    cx={marker.x}
                    cy={marker.ySuccess}
                    r={isActive ? 5 : 3.5}
                    className={cn(
                      'fill-emerald-500 stroke-background dark:fill-emerald-400',
                      (isActive || isHovered) && 'stroke-2'
                    )}
                    strokeWidth={isActive || isHovered ? 2 : 1}
                  />
                )}
                {marker.point.errorCount > 0 && (
                  <circle
                    cx={marker.x}
                    cy={marker.yError}
                    r={isActive || isHovered ? 5 : 3.5}
                    className={cn(
                      'fill-red-500 stroke-background dark:fill-red-400',
                      (isActive || isHovered) && 'stroke-2'
                    )}
                    strokeWidth={isActive || isHovered ? 2 : 1}
                  />
                )}
                {!marker.point.successCount && !marker.point.errorCount && (
                  <circle
                    cx={marker.x}
                    cy={marker.peakY}
                    r={isActive || isHovered ? 4 : 3}
                    className="fill-muted-foreground/40"
                  />
                )}
              </g>
            );
          })}

          {previewMarker && (
            <line
              x1={previewMarker.x}
              x2={previewMarker.x}
              y1={chart.paddingTop}
              y2={chart.baseline}
              className="stroke-muted-foreground/50"
              strokeWidth={1.5}
              strokeDasharray="3 4"
              pointerEvents="none"
            />
          )}

          {activeMarker && (
            <line
              x1={activeMarker.x}
              x2={activeMarker.x}
              y1={chart.paddingTop}
              y2={chart.baseline}
              className="stroke-primary"
              strokeWidth={2}
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}

          {points.map((point, index) => (
            <text
              key={point.key}
              x={chart.xForIndex(index)}
              y={chart.height - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {shortenAxisLabel(point.label)}
            </text>
          ))}

          <text
            x={12}
            y={chart.paddingTop + (chart.baseline - chart.paddingTop) / 2}
            textAnchor="middle"
            transform={`rotate(-90, 12, ${chart.paddingTop + (chart.baseline - chart.paddingTop) / 2})`}
            className="fill-muted-foreground text-[10px] font-medium"
          >
            DTEs
          </text>
        </svg>
      </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Exitosos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500 dark:bg-red-400" />
            Fallidos
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Escala 0–{chart.maxValue} · Hover: guía · Clic: detalle
        </p>
      </div>
    </div>
  );
}

function formatMonthlyQuota(mod: DashboardModuleStat) {
  const used = mod.monthlyUsed ?? 0;
  if (mod.limit === null || mod.limit === undefined) {
    return `Mes: ${used} DTE · Ilimitado`;
  }
  return `Mes: ${used} / ${mod.limit} DTE`;
}

function ModuleUsageBars({
  byModule,
  isRefetching = false,
}: {
  byModule: DashboardModuleStat[];
  isRefetching?: boolean;
}) {
  const modules = byModule;
  const maxRecords = Math.max(...modules.map((mod) => mod.records), 1);

  if (modules.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
        Sin modulos disponibles en tu plan.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border border-border/60 bg-muted/10 p-3 transition-opacity',
        isRefetching && 'opacity-60'
      )}
    >
      {isRefetching && (
        <div className="pointer-events-none absolute right-3 top-3">
          <RefreshCw className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Uso por modulo</p>
        <p className="text-[11px] text-muted-foreground">DTEs procesados (30d)</p>
      </div>
      <div className="max-h-[210px] space-y-3 overflow-y-auto pr-1">
        {modules.map((mod) => {
          const width = Math.max(4, (mod.records / maxRecords) * 100);
          return (
            <div key={`${mod.routeKey}-${mod.moduleName}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium">{mod.moduleName}</span>
                <span className="shrink-0 font-semibold">{mod.records}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span>{mod.count} procesos</span>
                <span>
                  {mod.successCount} ok / {mod.errorCount} error
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{formatMonthlyQuota(mod)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActivityPeriodChart({
  daily,
  weekly,
  monthly,
  byModule = [],
  loading,
  emptyHref = '/verificadorDTE/verificador',
  className,
  onRefresh,
  isRefetching,
}: ActivityPeriodChartProps) {
  const [period, setPeriod] = useState<ActivityPeriod>('day');

  const activePoints =
    period === 'day' ? daily : period === 'week' ? weekly : monthly;
  const hasActivity =
    hasOutcomeActivity(daily) ||
    hasOutcomeActivity(weekly) ||
    hasOutcomeActivity(monthly);
  const hasModuleUsage = byModule.length > 0;
  const showEmptyChart = !hasActivity;

  return (
    <FadeIn delay={0.1} className={cn('h-full', className)}>
      <Card className="h-full gap-0 py-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 pb-3">
          <CardTitle className="text-base">Actividad</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
              {PERIOD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    period === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading || isRefetching}
                className="h-8 gap-2"
              >
                <RefreshCw
                  className={cn('size-3.5', isRefetching && 'animate-spin')}
                />
                {isRefetching ? 'Actualizando...' : 'Actualizar'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="h-[210px] animate-pulse rounded-lg bg-muted/40" />
              <div className="h-[210px] animate-pulse rounded-lg bg-muted/40" />
            </div>
          ) : showEmptyChart && !hasModuleUsage ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
                <Activity className="size-6 text-muted-foreground" />
              </span>
              <p className="max-w-xs text-sm text-muted-foreground">
                Aun no hay DTEs exitosos o fallidos registrados. Usa un atajo DTE
                para empezar.
              </p>
              <Link
                href={emptyHref}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Ir al verificador
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
              {showEmptyChart ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-8 text-center">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
                    <Activity className="size-6 text-muted-foreground" />
                  </span>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Aun no hay DTEs exitosos o fallidos registrados en el grafico.
                  </p>
                  <Link
                    href={emptyHref}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    Ir al verificador
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : (
                <OutcomeAreaChart points={activePoints} />
              )}
              <ModuleUsageBars byModule={byModule} isRefetching={isRefetching} />
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
