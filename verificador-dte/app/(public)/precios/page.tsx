import type { Metadata } from 'next';

import PublicNavbar from '@/components/PublicNavbar';
import PricingSection from '@/components/PricingSection';

export const metadata: Metadata = {
  title: 'Precios Kaiser DTE',
  description:
    'Planes y precios para verificar DTE, consultar documentos tributarios electronicos y gestionar comprobantes en El Salvador.',
  alternates: { canonical: '/precios' },
};

export default function PreciosPage() {
  return (
    <main className="min-h-screen bg-slate-50 pt-20 text-slate-950 dark:bg-black dark:text-white">
      <PublicNavbar />
      <section className="px-4 pb-4 pt-12 text-center sm:px-6 lg:px-16">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
          Planes
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold sm:text-5xl">
          Precios para verificacion y gestion de DTE
        </h1>
        <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-700 dark:text-zinc-300">
          Elige un plan para consultar, validar y organizar documentos tributarios electronicos segun el volumen de tu empresa o despacho contable.
        </p>
      </section>
      <PricingSection />
    </main>
  );
}
