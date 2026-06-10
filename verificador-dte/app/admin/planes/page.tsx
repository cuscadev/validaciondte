'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Eye,
  EyeOff,
  Infinity,
  Loader2,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react';

import { auth } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_FREE_ROUTES,
  DEFAULT_PREMIUM_ROUTES,
  DEFAULT_PRO_ROUTES,
  PLAN_ROUTE_GROUPS,
} from '@/lib/plan-routes';

const PLANS = [
  { id: 'free', label: 'Free', description: 'Acceso inicial para probar la plataforma.' },
  { id: 'premium', label: 'Premium', description: 'Plan recomendado para operacion recurrente.', featured: true },
  { id: 'pro', label: 'Pro', description: 'Uso avanzado con mayor capacidad operativa.' },
];

const PLANS_QUERY_KEY = ['admin', 'plans'] as const;
const PLANS_CACHE_MS = 5 * 60 * 1000;

type BillingCycle = 'mensual' | 'anual' | 'personalizado';

interface PlanConfig {
  allowedRoutes: string[];
  queryLimit: number | null;
  mobileScanFolderLimit: number | null;
  maxCollaborators: number;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  dateFrom: string;
  dateTo: string;
  visibleInLanding: boolean;
}

type PlansState = Record<string, PlanConfig>;

const DEFAULT_PLANS: PlansState = {
  free: {
    allowedRoutes: DEFAULT_FREE_ROUTES,
    queryLimit: null,
    mobileScanFolderLimit: null,
    maxCollaborators: 2,
    price: 0,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
    visibleInLanding: true,
  },
  premium: {
    allowedRoutes: DEFAULT_PREMIUM_ROUTES,
    queryLimit: null,
    mobileScanFolderLimit: null,
    maxCollaborators: 10,
    price: 19.99,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
    visibleInLanding: true,
  },
  pro: {
    allowedRoutes: DEFAULT_PRO_ROUTES,
    queryLimit: null,
    mobileScanFolderLimit: null,
    maxCollaborators: 50,
    price: 49.99,
    currency: 'USD',
    billingCycle: 'mensual',
    dateFrom: '',
    dateTo: '',
    visibleInLanding: true,
  },
};

function calcDateTo(from: string, cycle: BillingCycle): string {
  if (!from || cycle === 'personalizado') return '';
  const d = new Date(from);
  if (cycle === 'mensual') d.setMonth(d.getMonth() + 1);
  if (cycle === 'anual') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

function cycleLabel(cycle: BillingCycle) {
  if (cycle === 'mensual') return 'Mensual';
  if (cycle === 'anual') return 'Anual';
  return 'Custom';
}

export default function PlanesPage() {
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<PlansState>(DEFAULT_PLANS);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/planes');
      if (!res.ok) throw new Error('No se pudieron cargar los planes');
      return await res.json() as Partial<PlansState>;
    },
    staleTime: PLANS_CACHE_MS,
    gcTime: PLANS_CACHE_MS,
  });

  useEffect(() => {
    if (!plansQuery.data) return;

    setPlans(prev => {
      const merged = { ...prev };
      for (const key of Object.keys(prev)) {
        if (plansQuery.data?.[key]) {
          merged[key] = {
            ...prev[key],
            ...plansQuery.data[key],
            mobileScanFolderLimit:
              plansQuery.data[key].mobileScanFolderLimit ?? prev[key].mobileScanFolderLimit,
            maxCollaborators:
              plansQuery.data[key].maxCollaborators ?? prev[key].maxCollaborators,
          };
        }
      }
      return merged;
    });
  }, [plansQuery.data]);

  const summary = useMemo(() => {
    const values = Object.values(plans);
    return {
      visible: values.filter(plan => plan.visibleInLanding).length,
      unlimited: values.filter(plan => plan.queryLimit === null).length,
      routes: values.reduce((total, plan) => total + plan.allowedRoutes.length, 0),
    };
  }, [plans]);

  const update = <K extends keyof PlanConfig>(planId: string, field: K, value: PlanConfig[K]) => {
    setPlans(prev => {
      const updated = { ...prev[planId], [field]: value };

      if ((field === 'dateFrom' || field === 'billingCycle') && updated.billingCycle !== 'personalizado') {
        updated.dateTo = calcDateTo(
          field === 'dateFrom' ? (value as string) : updated.dateFrom,
          field === 'billingCycle' ? (value as BillingCycle) : updated.billingCycle,
        );
      }

      return { ...prev, [planId]: updated };
    });
  };

  const toggleRoute = (planId: string, routeKey: string) => {
    setPlans(prev => {
      const current = prev[planId].allowedRoutes;
      const updated = current.includes(routeKey)
        ? current.filter(r => r !== routeKey)
        : [...current, routeKey];
      return { ...prev, [planId]: { ...prev[planId], allowedRoutes: updated } };
    });
  };

  const handleSave = async (planId: string) => {
    setSaving(planId);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/planes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          plan: plans[planId],
        }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el plan');

      queryClient.setQueryData<Partial<PlansState>>(PLANS_QUERY_KEY, current => ({
        ...current,
        [planId]: plans[planId],
      }));
      setSaved(planId);
      setTimeout(() => setSaved(null), 2000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar el plan');
    } finally {
      setSaving(null);
    }
  };

  if (plansQuery.isLoading) {
    return (
      <main className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando planes...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 p-0">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
                <Settings2 className="size-4" />
                Gestion de planes
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                Configura precios, accesos y visibilidad
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 md:text-base dark:text-zinc-300">
                Los cambios se guardan por plan y aplican inmediatamente en el control de acceso y en la seccion publica de planes.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[34rem]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <Eye className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Landing</p>
                <p className="mt-1 text-sm font-bold">{summary.visible} visibles</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <Infinity className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Ilimitados</p>
                <p className="mt-1 text-sm font-bold">{summary.unlimited} planes</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <BadgeCheck className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Accesos</p>
                <p className="mt-1 text-sm font-bold">{summary.routes} activos</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {PLANS.map(plan => {
            const cfg = plans[plan.id];
            const isSaved = saved === plan.id;
            const isSaving = saving === plan.id;

            return (
              <article
                key={plan.id}
                className={[
                  'flex min-h-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-zinc-950',
                  plan.featured
                    ? 'border-yellow-300 dark:border-yellow-300/60'
                    : 'border-slate-200 dark:border-white/10',
                ].join(' ')}
              >
                <header className="border-b border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-black">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold">{plan.label}</h2>
                        {plan.featured && (
                          <Badge className="bg-yellow-400 text-black hover:bg-yellow-400">Popular</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                        {plan.description}
                      </p>
                    </div>

                    <div className="rounded-md bg-yellow-400 p-2 text-black">
                      <Sparkles className="size-5" />
                    </div>
                  </div>
                </header>

                <div className="flex flex-1 flex-col gap-6 p-5">
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                      Precio
                    </p>
                    <div className="flex overflow-hidden rounded-md border border-slate-200 bg-background dark:border-white/10">
                      <select
                        value={cfg.currency}
                        onChange={e => update(plan.id, 'currency', e.target.value)}
                        className="border-r border-slate-200 bg-slate-100 px-2 py-2 text-sm outline-none dark:border-white/10 dark:bg-black"
                      >
                        <option>USD</option>
                        <option>EUR</option>
                        <option>CRC</option>
                        <option>GTQ</option>
                        <option>SVC</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={cfg.price}
                        onChange={e => update(plan.id, 'price', parseFloat(e.target.value) || 0)}
                        className="min-w-0 flex-1 bg-background px-3 py-2 text-sm outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </section>

                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                      Ciclo de facturacion
                    </p>
                    <div className="grid grid-cols-3 overflow-hidden rounded-md border border-slate-200 text-sm dark:border-white/10">
                      {(['mensual', 'anual', 'personalizado'] as BillingCycle[]).map(cycle => (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => update(plan.id, 'billingCycle', cycle)}
                          className={`px-2 py-2 transition ${
                            cfg.billingCycle === cycle
                              ? 'bg-yellow-400 font-bold text-black'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-black'
                          }`}
                        >
                          {cycleLabel(cycle)}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                      <CalendarClock className="size-3.5" />
                      Vigencia
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Desde
                        <input
                          type="date"
                          value={cfg.dateFrom}
                          onChange={e => update(plan.id, 'dateFrom', e.target.value)}
                          className="rounded-md border border-slate-200 bg-background px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/10"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Hasta {cfg.billingCycle !== 'personalizado' && <span className="text-[10px]">(auto)</span>}
                        <input
                          type="date"
                          value={cfg.dateTo}
                          readOnly={cfg.billingCycle !== 'personalizado'}
                          onChange={e => cfg.billingCycle === 'personalizado' && update(plan.id, 'dateTo', e.target.value)}
                          className={`rounded-md border border-slate-200 bg-background px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/10 ${
                            cfg.billingCycle !== 'personalizado' ? 'cursor-not-allowed opacity-60' : ''
                          }`}
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                      Herramientas con acceso
                    </p>
                    <div className="grid gap-2">
                      {PLAN_ROUTE_GROUPS.map(group => (
                        <div key={group.key}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                            {group.label}
                          </p>
                          <div className="grid gap-2">
                            {group.routes.map(route => {
                              const checked = cfg.allowedRoutes.includes(route.key);
                              return (
                                <label
                                  key={route.key}
                                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                                    checked
                                      ? 'border-yellow-300 bg-yellow-50 text-slate-950 dark:border-yellow-400/50 dark:bg-yellow-400/10 dark:text-white'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-black'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleRoute(plan.id, route.key)}
                                    className="size-4 rounded accent-yellow-400"
                                  />
                                  <span>{route.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                      Limite de consultas / mes
                    </p>
                    <label className="mb-3 flex cursor-pointer items-center gap-3 text-sm text-slate-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={cfg.queryLimit === null}
                        onChange={() => update(plan.id, 'queryLimit', cfg.queryLimit === null ? 1 : null)}
                        className="size-4 rounded accent-yellow-400"
                      />
                      <span className="flex items-center gap-2">
                        <Infinity className="size-4" />
                        Ilimitado
                      </span>
                    </label>
                    {cfg.queryLimit !== null && (
                      <input
                        type="number"
                        min={1}
                        value={cfg.queryLimit}
                        onChange={e => update(plan.id, 'queryLimit', parseInt(e.target.value) || 1)}
                        className="w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/10"
                        placeholder="Ej: 50"
                      />
                    )}
                  </section>

                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                      Links por carpeta mobile
                    </p>
                    <label className="mb-3 flex cursor-pointer items-center gap-3 text-sm text-slate-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={cfg.mobileScanFolderLimit === null}
                        onChange={() => update(plan.id, 'mobileScanFolderLimit', cfg.mobileScanFolderLimit === null ? 1 : null)}
                        className="size-4 rounded accent-yellow-400"
                      />
                      <span className="flex items-center gap-2">
                        <Infinity className="size-4" />
                        Ilimitado por carpeta
                      </span>
                    </label>
                    {cfg.mobileScanFolderLimit !== null && (
                      <input
                        type="number"
                        min={1}
                        value={cfg.mobileScanFolderLimit}
                        onChange={e => update(plan.id, 'mobileScanFolderLimit', parseInt(e.target.value) || 1)}
                        className="w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/10"
                        placeholder="Ej: 25"
                      />
                    )}
                  </section>

                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                      Cupos de colaboradores
                    </p>
                    <input
                      type="number"
                      min={0}
                      value={cfg.maxCollaborators ?? 0}
                      onChange={e => update(plan.id, 'maxCollaborators', parseInt(e.target.value, 10) || 0)}
                      className="w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/10"
                      placeholder="Ej: 10"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Solo cuentan usuarios colaborador; el cliente dueño no ocupa cupo.
                    </p>
                  </section>

                  <section className="mt-auto flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-black">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {cfg.visibleInLanding ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        Visible en landing
                      </p>
                      <p className="text-xs text-muted-foreground">Mostrar este plan en la pagina publica.</p>
                    </div>
                    <Switch
                      checked={cfg.visibleInLanding}
                      onCheckedChange={(checked) => update(plan.id, 'visibleInLanding', checked)}
                      className="data-[state=checked]:bg-yellow-400"
                    />
                  </section>
                </div>

                <footer className="border-t border-slate-200 p-5 dark:border-white/10">
                  <Button
                    onClick={() => handleSave(plan.id)}
                    disabled={isSaving}
                    className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Guardando...
                      </>
                    ) : isSaved ? (
                      <>
                        <Check className="size-4" />
                        Guardado
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                </footer>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
