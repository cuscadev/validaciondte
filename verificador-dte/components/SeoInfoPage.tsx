import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import PublicNavbar from '@/components/PublicNavbar';
import { Button } from '@/components/ui/button';

type SeoInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
  bullets: string[];
};

export default function SeoInfoPage({
  eyebrow,
  title,
  description,
  sections,
  bullets,
}: SeoInfoPageProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      <section className="border-b border-border bg-background px-4 pb-16 pt-28 sm:px-6 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            {description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup">
              <Button className="bg-primary font-bold text-primary-foreground hover:bg-primary/90">
                Solicitar acceso
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Volver al inicio</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-5">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-lg border border-border bg-card p-6 shadow-sm"
              >
                <h2 className="text-2xl font-bold">{section.title}</h2>
                <p className="mt-3 leading-7 text-muted-foreground">
                  {section.body}
                </p>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold">Beneficios clave</h2>
            <div className="mt-5 space-y-4">
              {bullets.map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
