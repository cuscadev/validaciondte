'use client';

import { useQuery } from '@tanstack/react-query';
import { FadeIn } from '@/components/motion/FadeIn';
import Link from 'next/link';
import { ArrowRight, Check, Infinity, Sparkles } from 'lucide-react';

const VERIFICADOR_ROUTES: Record<string, string> = {
  verificador: 'Verificador Links',
  verificarodyfecha: 'Codigo y Fecha',
  verificadorjson: 'Verificador JSON',
  verificacion_individual: 'Verificacion Individual',
};

const PLAN_META: Record<string, { label: string; badge?: string; featured?: boolean }> = {
  free: { label: 'Free' },
  premium: { label: 'Premium', badge: 'Popular', featured: true },
  pro: { label: 'Pro', badge: 'Avanzado' },
};

interface PlanConfig {
  allowedRoutes: string[];
  queryLimit: number | null;
  price: number;
  currency: string;
  billingCycle: string;
  visibleInLanding: boolean;
}

function cycleLabel(cycle: string) {
  if (cycle === 'mensual') return '/mes';
  if (cycle === 'anual') return '/ano';
  return '';
}

export default function PricingSection() {
  const { data: plans = {}, isLoading: loading } = useQuery({
    queryKey: ['public', 'planes'],
    queryFn: async () => {
      const res = await fetch('/api/planes');
      if (!res.ok) return {};

      return (await res.json()) as Record<string, PlanConfig>;
    },
  });

  const visiblePlans = plans
    ? Object.entries(plans).filter(([, cfg]) => cfg.visibleInLanding !== false)
    : [];

  return (
    <section
      id="planes"
      aria-labelledby="pricing-title"
      className="relative z-10 w-full border-t border-border bg-muted px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto max-w-3xl text-center" inView y={34} viewportAmount={0.45}>
          <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            <Sparkles className="size-4" />
            Planes
          </p>
          <h2 id="pricing-title" className="text-3xl font-bold md:text-5xl">
            Elige el acceso que necesita tu operacion
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Compara herramientas incluidas, limites de consulta y opciones de crecimiento para tu flujo DTE.
          </p>
        </FadeIn>

        {loading ? (
          <div className="mt-12 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
            Cargando planes...
          </div>
        ) : visiblePlans.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <h3 className="text-xl font-bold">Planes proximamente disponibles</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Estamos preparando las opciones de acceso. Puedes solicitar una cuenta y te contactaremos.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              Solicitar acceso
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className={`mt-12 grid gap-4 ${visiblePlans.length === 1 ? 'mx-auto max-w-md grid-cols-1' : visiblePlans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {visiblePlans.map(([planId, cfg], index) => {
              const meta = PLAN_META[planId] ?? { label: planId };
              const featured = Boolean(meta.featured);
              const price = cfg.price ?? 0;

              return (
                <FadeIn
                  as="article"
                  key={planId}
                  className={[
                    'relative flex min-h-full flex-col rounded-xl border p-6 shadow-sm',
                    featured
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground',
                  ].join(' ')}
                  inView
                  y={36}
                  delay={index * 0.08}
                  duration={0.65}
                  viewportAmount={0.35}
                >
                  {meta.badge && (
                    <span className={`absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-bold ${featured ? 'bg-primary-foreground text-background' : 'bg-primary text-primary-foreground'}`}>
                      {meta.badge}
                    </span>
                  )}

                  <h3 className={`text-xl font-bold ${featured ? 'text-primary-foreground' : 'text-primary'}`}>
                    {meta.label}
                  </h3>

                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-extrabold">
                      {price === 0 ? 'Gratis' : `${cfg.currency ?? 'USD'} ${price.toFixed(2)}`}
                    </span>
                    {price > 0 && (
                      <span className={`mb-1 text-sm ${featured ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {cycleLabel(cfg.billingCycle)}
                      </span>
                    )}
                  </div>

                  <div className={`mt-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${featured ? 'bg-primary-foreground/10 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {cfg.queryLimit === null ? (
                      <>
                        <Infinity className="size-4" />
                        Consultas ilimitadas
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        {cfg.queryLimit} consultas / mes
                      </>
                    )}
                  </div>

                  <div className="mt-6 flex flex-1 flex-col gap-2">
                    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${featured ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      Herramientas incluidas
                    </p>
                    {Object.entries(VERIFICADOR_ROUTES).map(([key, label]) => {
                      const included = cfg.allowedRoutes.includes(key);
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2 text-sm ${included ? '' : featured ? 'text-primary-foreground/45 line-through' : 'text-muted-foreground/50 line-through'}`}
                        >
                          <Check className={`size-4 shrink-0 ${included ? featured ? 'text-primary-foreground' : 'text-brand-success' : 'opacity-30'}`} />
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  <Link
                    href={`/signup?plan=${encodeURIComponent(planId)}`}
                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition ${
                      featured
                        ? 'bg-primary-foreground text-background hover:bg-primary-foreground/90'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {price === 0 ? 'Empezar gratis' : 'Solicitar acceso'}
                    <ArrowRight className="size-4" />
                  </Link>
                </FadeIn>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
