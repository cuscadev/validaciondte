//src/app/tributario/page.tsx
import { CalendarDays, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ObligationsCalendar from '@/components/obligations/ObligationsCalendar';

const TAX_CALENDAR_URL =
  'https://www.mh.gob.sv/wp-content/uploads/2025/12/Calendario-Tributario-2026.pdf';

export default function TributarioPage() {
  return (
    <main className="space-y-4">
      <section className="rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-yellow-400 text-black">
              <CalendarDays className="size-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Calendario tributario 2026
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Consulta el calendario oficial publicado por el Ministerio de Hacienda de El Salvador.
              </p>
            </div>
          </div>

          <Button asChild className="bg-yellow-400 font-semibold text-black hover:bg-yellow-300">
            <a href={TAX_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
              Abrir PDF
              <ExternalLink className="ml-2 size-4" />
            </a>
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-background p-4 shadow-sm">
        <ObligationsCalendar />
      </section>
    </main>
  );
}