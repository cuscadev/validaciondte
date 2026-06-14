'use client';

import { useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PLAN_ROUTE_GROUPS } from '@/lib/plan-routes';
import {
  getRouteAccessState,
  isRouteEnabled,
  toggleRouteOverride,
  type RouteAccessOverride,
} from '@/lib/route-access-overrides';

type PlanRouteSelectorProps =
  | {
      mode: 'plan';
      selectedRoutes: string[];
      onSelectedRoutesChange: (routes: string[]) => void;
    }
  | {
      mode: 'override';
      planRoutes: string[];
      override?: RouteAccessOverride;
      onOverrideChange: (next: RouteAccessOverride | undefined) => void;
    };

function accessBadge(state: 'plan' | 'grant' | 'denial' | 'none') {
  if (state === 'grant') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
        Extra
      </span>
    );
  }
  if (state === 'denial') {
    return (
      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-300">
        Bloq.
      </span>
    );
  }
  if (state === 'plan') {
    return (
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Plan
      </span>
    );
  }
  return null;
}

export function PlanRouteSelector(props: PlanRouteSelectorProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isChecked = (routeKey: string) => {
    if (props.mode === 'plan') {
      return props.selectedRoutes.includes(routeKey);
    }
    return isRouteEnabled(props.planRoutes, props.override, routeKey);
  };

  const toggleRoute = (routeKey: string, enabled: boolean) => {
    if (props.mode === 'plan') {
      const current = props.selectedRoutes;
      const next = enabled
        ? [...new Set([...current, routeKey])]
        : current.filter((key) => key !== routeKey);
      props.onSelectedRoutesChange(next);
      return;
    }

    props.onOverrideChange(
      toggleRouteOverride(props.planRoutes, props.override, routeKey, enabled),
    );
  };

  const toggleGroup = (routeKeys: string[], enabled: boolean) => {
    if (props.mode === 'plan') {
      const current = new Set(props.selectedRoutes);
      routeKeys.forEach((key) => {
        if (enabled) current.add(key);
        else current.delete(key);
      });
      props.onSelectedRoutesChange([...current]);
      return;
    }

    let nextOverride = props.override;
    routeKeys.forEach((key) => {
      nextOverride = toggleRouteOverride(props.planRoutes, nextOverride, key, enabled);
    });
    props.onOverrideChange(nextOverride);
  };

  return (
    <div className="space-y-2">
      {props.mode === 'override' ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Puedes agregar o quitar vistas aunque el usuario tenga un plan asignado.{' '}
          <span className="font-medium">Plan</span> = incluido por membresia,{' '}
          <span className="font-medium text-emerald-600 dark:text-emerald-300">Extra</span> = agregado manualmente,{' '}
          <span className="font-medium text-red-600 dark:text-red-300">Bloq.</span> = quitado manualmente.
        </p>
      ) : null}

      {PLAN_ROUTE_GROUPS.map((group) => {
        const routeKeys = group.routes.map((route) => route.key);
        const active = routeKeys.filter((key) => isChecked(key)).length;
        const open = openGroups[group.key] ?? false;
        const allSelected = active === routeKeys.length;
        const noneSelected = active === 0;

        return (
          <Collapsible
            key={group.key}
            open={open}
            onOpenChange={(next) => setOpenGroups((current) => ({ ...current, [group.key]: next }))}
            className="overflow-hidden rounded-lg border border-border bg-background"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    open && 'rotate-180',
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{group.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {active} de {routeKeys.length} activas
                  </p>
                </div>
              </CollapsibleTrigger>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Activar todas"
                  disabled={allSelected}
                  onClick={() => toggleGroup(routeKeys, true)}
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Desactivar todas"
                  disabled={noneSelected}
                  onClick={() => toggleGroup(routeKeys, false)}
                >
                  <Minus className="size-4" />
                </Button>
              </div>
            </div>

            <CollapsibleContent className="border-t border-border px-3 py-2">
              <div className="grid gap-1.5">
                {group.routes.map((route) => {
                  const checked = isChecked(route.key);
                  const state =
                    props.mode === 'override'
                      ? getRouteAccessState(props.planRoutes, props.override, route.key)
                      : checked
                        ? 'plan'
                        : 'none';

                  return (
                    <label
                      key={route.key}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition',
                        checked
                          ? 'border-primary/50 bg-primary/10 text-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleRoute(route.key, event.target.checked)}
                        className="size-4 shrink-0 rounded accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate">{route.label}</span>
                      {props.mode === 'override' ? accessBadge(state) : null}
                    </label>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
