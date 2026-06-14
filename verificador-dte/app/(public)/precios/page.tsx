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
    <main className="min-h-screen bg-background pt-20 text-foreground">
      <PublicNavbar />
      <section className="px-4 pb-4 pt-12 text-center sm:px-6 lg:px-16">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
          Planes
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold sm:text-5xl">
          Precios para verificacion y gestion de DTE
        </h1>
        <p className="mx-auto mt-5 max-w-2xl leading-7 text-muted-foreground">
          Elige un plan para consultar, validar y organizar documentos tributarios electronicos segun el volumen de tu empresa o despacho contable.
        </p>
      </section>
      <PricingSection />
    </main>
  );
}
