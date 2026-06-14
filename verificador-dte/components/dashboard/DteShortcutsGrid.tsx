'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  FileJson,
  FileSearch,
  FileText,
  Link2,
  type LucideIcon,
} from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type DteShortcut = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

export const dteShortcuts: DteShortcut[] = [
  {
    title: 'Verificador Links',
    description: 'Procesa enlaces DTE y genera resultados consolidados.',
    href: '/verificadorDTE/verificador',
    icon: Link2,
    accent: 'bg-primary/15 text-primary',
  },
  {
    title: 'Codigo y Fecha',
    description: 'Consulta por codigo de generacion y fecha de emision.',
    href: '/verificadorDTE/verificarodyfecha',
    icon: CalendarDays,
    accent: 'bg-brand-purple/15 text-brand-purple',
  },
  {
    title: 'Verificador JSON',
    description: 'Carga archivos JSON de DTE para validarlos por lote.',
    href: '/verificadorDTE/verificadorjson',
    icon: FileJson,
    accent: 'bg-brand-success/15 text-brand-success',
  },
  {
    title: 'Verificacion Individual',
    description: 'Valida DTEs manualmente con detalle por documento.',
    href: '/verificadorDTE/verificacion_individual',
    icon: FileSearch,
    accent: 'bg-brand-orange/15 text-brand-orange',
  },
];

type DteShortcutsGridProps = {
  className?: string;
};

export function DteShortcutsGrid({ className }: DteShortcutsGridProps) {
  return (
    <FadeIn delay={0.18} className={cn('h-full', className)}>
      <Card className="h-full border-border/60 bg-muted/10 py-0 shadow-sm">
        <CardContent className="flex h-full flex-col p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Atajos DTE
              </p>
              <h2 className="mt-2 text-xl font-bold md:text-2xl">
                Procesa diferentes tipos de documentos
              </h2>
            </div>
            <FileText className="hidden size-9 text-muted-foreground/40 sm:block" />
          </div>

          <div className="grid flex-1 gap-3 md:grid-cols-2">
            {dteShortcuts.map((item, index) => {
              const Icon = item.icon;

              return (
                <FadeIn key={item.href} delay={0.2 + index * 0.04}>
                  <Link
                    href={item.href}
                    className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent hover:shadow-md"
                  >
                    <div
                      className={`mb-3 flex size-11 items-center justify-center rounded-xl ${item.accent}`}
                    >
                      <Icon className="size-5" />
                    </div>

                    <div className="flex flex-1 items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{item.title}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-muted-foreground md:line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                  </Link>
                </FadeIn>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
