export type RouteAccessOverride = {
  grants?: string[];
  denials?: string[];
};

export function resolveEffectiveRoutes(
  planRoutes: string[],
  override?: RouteAccessOverride | null,
): string[] {
  const grants = override?.grants ?? [];
  const denials = new Set(override?.denials ?? []);
  return [...new Set([...planRoutes, ...grants])].filter((key) => !denials.has(key));
}

export function getRouteAccessState(
  planRoutes: string[],
  override: RouteAccessOverride | undefined,
  routeKey: string,
): 'plan' | 'grant' | 'denial' | 'none' {
  const inPlan = planRoutes.includes(routeKey);
  const granted = override?.grants?.includes(routeKey) ?? false;
  const denied = override?.denials?.includes(routeKey) ?? false;

  if (denied) return 'denial';
  if (granted) return 'grant';
  if (inPlan) return 'plan';
  return 'none';
}

export function isRouteEnabled(
  planRoutes: string[],
  override: RouteAccessOverride | undefined,
  routeKey: string,
): boolean {
  return resolveEffectiveRoutes(planRoutes, override).includes(routeKey);
}

export function toggleRouteOverride(
  planRoutes: string[],
  current: RouteAccessOverride | undefined,
  routeKey: string,
  enabled: boolean,
): RouteAccessOverride | undefined {
  const grants = new Set(current?.grants ?? []);
  const denials = new Set(current?.denials ?? []);
  const inPlan = planRoutes.includes(routeKey);

  if (enabled) {
    denials.delete(routeKey);
    if (!inPlan) grants.add(routeKey);
    else grants.delete(routeKey);
  } else {
    grants.delete(routeKey);
    if (inPlan) denials.add(routeKey);
    else denials.delete(routeKey);
  }

  const next: RouteAccessOverride = {
    ...(grants.size ? { grants: [...grants] } : {}),
    ...(denials.size ? { denials: [...denials] } : {}),
  };

  return next.grants || next.denials ? next : undefined;
}

export function sanitizeRouteAccessOverride(raw: unknown): RouteAccessOverride | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const source = raw as Record<string, unknown>;
  const grants = Array.isArray(source.grants)
    ? source.grants.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : undefined;
  const denials = Array.isArray(source.denials)
    ? source.denials.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : undefined;

  if (!grants?.length && !denials?.length) return undefined;

  return {
    ...(grants?.length ? { grants } : {}),
    ...(denials?.length ? { denials } : {}),
  };
}
