'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  extendedProps?: {
    description?: string;
    category?: string;
    status?: 'pending' | 'completed' | 'expired';
    notifyClient?: boolean;
    reminderDaysBefore?: number[];
    targetMode?: string;
    targetRole?: string;
    targetUids?: string[];
  };
};

function formatSelectedDate(date: string | null) {
  if (!date) return 'Selecciona un día';

  return new Date(`${date}T00:00:00`).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function addDays(date: string | null, days: number) {
  if (!date) return null;

  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);

  return current.toISOString().slice(0, 10);
}

export default function ObligationsCalendar() {
  const [selectedDate, setSelectedDate] = useState<string | null>(
    new Date().toISOString().slice(0, 10)
  );

  const obligationsQuery = useQuery({
    queryKey: ['tributario-calendar'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        throw new Error('No autorizado');
      }

      const res = await fetch('/api/tributario/calendario', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo cargar el calendario.');
      }

      return data.events as CalendarEvent[];
    },
  });

  const calendarEvents = obligationsQuery.data ?? [];

  const selectedObligations = useMemo(() => {
    if (!selectedDate) return [];
    return calendarEvents.filter((item) => item.date === selectedDate);
  }, [calendarEvents, selectedDate]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <style jsx global>{`
        .fc {
          --fc-border-color: rgba(15, 23, 42, 0.12);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: rgba(15, 23, 42, 0.04);
          --fc-today-bg-color: rgba(250, 204, 21, 0.18);
          --fc-event-bg-color: #06b6d4;
          --fc-event-border-color: #06b6d4;
          --fc-event-text-color: #001014;
          color: #0f172a;
        }

        .dark .fc {
          --fc-border-color: rgba(255, 255, 255, 0.09);
          --fc-neutral-bg-color: rgba(255, 255, 255, 0.04);
          --fc-today-bg-color: rgba(250, 204, 21, 0.08);
          color: #ffffff;
        }

        .fc .fc-toolbar {
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 800;
          text-transform: capitalize;
        }

        .fc .fc-button {
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #ffffff;
          color: #0f172a;
          border-radius: 0.55rem;
          padding: 0.45rem 0.75rem;
          font-weight: 700;
          box-shadow: none;
          text-transform: capitalize;
        }

        .dark .fc .fc-button {
          border-color: rgba(255, 255, 255, 0.1);
          background: #18181b;
          color: #ffffff;
        }

        .fc .fc-button:hover {
          background: #f8fafc;
        }

        .dark .fc .fc-button:hover {
          background: #27272a;
        }

        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background: #facc15;
          border-color: #facc15;
          color: #000;
        }

        .fc .fc-col-header-cell {
          background: #f8fafc;
          padding: 0.65rem 0;
        }

        .dark .fc .fc-col-header-cell {
          background: #18181b;
        }

        .fc .fc-col-header-cell-cushion {
          color: #475569;
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          text-decoration: none;
        }

        .dark .fc .fc-col-header-cell-cushion {
          color: #a1a1aa;
        }

        .fc .fc-daygrid-day {
          background: #ffffff;
        }

        .dark .fc .fc-daygrid-day {
          background: #09090b;
        }

        .fc .fc-daygrid-day-frame {
          min-height: 6.8rem;
          padding: 0.35rem;
        }

        .fc .fc-daygrid-day-number {
          color: #0f172a;
          font-size: 0.85rem;
          font-weight: 700;
          text-decoration: none;
        }

        .dark .fc .fc-daygrid-day-number {
          color: #f8fafc;
        }

        .fc .fc-day-other .fc-daygrid-day-number {
          color: #94a3b8;
        }

        .dark .fc .fc-day-other .fc-daygrid-day-number {
          color: #52525b;
        }

        .fc .fc-daygrid-event {
          border-radius: 0.45rem;
          padding: 0.12rem 0.45rem;
          font-size: 0.72rem;
          font-weight: 800;
        }
      `}</style>

      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">
            Agenda tributaria
          </h2>

          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Selecciona un día para ver las obligaciones programadas.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => obligationsQuery.refetch()}
        >
          <RefreshCcw className="mr-2 size-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black">
          {obligationsQuery.isLoading ? (
            <div className="flex min-h-[34rem] items-center justify-center text-sm text-slate-500 dark:text-zinc-400">
              <RefreshCcw className="mr-2 size-4 animate-spin" />
              Cargando calendario...
            </div>
          ) : obligationsQuery.isError ? (
            <div className="flex min-h-[34rem] items-center justify-center rounded-lg border border-rose-500/20 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/20 dark:text-rose-200">
              {obligationsQuery.error instanceof Error
                ? obligationsQuery.error.message
                : 'No se pudo cargar el calendario.'}
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="es"
              height="auto"
              selectable
              dayMaxEvents
              events={calendarEvents}
              dateClick={(info: DateClickArg) => setSelectedDate(info.dateStr)}
              eventClick={(info: EventClickArg) =>
                setSelectedDate(info.event.startStr.slice(0, 10))
              }
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              buttonText={{
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
              }}
            />
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-black">
          <div className="mb-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-yellow-300">
              <CalendarDays className="size-4" />
              Obligaciones
            </p>

            <h3 className="mt-1 text-lg font-bold capitalize text-slate-950 dark:text-white">
              {formatSelectedDate(selectedDate)}
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
              {selectedObligations.length}{' '}
              {selectedObligations.length === 1 ? 'actividad' : 'actividades'}
            </p>
          </div>

          {selectedObligations.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400">
              No hay obligaciones programadas para este día.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedObligations.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-950 dark:text-white">
                        {item.title}
                      </h4>

                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                        {item.extendedProps?.status === 'completed'
                          ? 'Completada'
                          : item.extendedProps?.status === 'expired'
                            ? 'Vencida'
                            : 'Pendiente'}
                      </p>

                      {item.extendedProps?.description && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                          {item.extendedProps.description}
                        </p>
                      )}

                      <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.extendedProps?.category || 'Tributario'}
                      </p>

                      {item.extendedProps?.notifyClient && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                          Recordatorio:{' '}
                          {item.extendedProps.reminderDaysBefore?.length
                            ? item.extendedProps.reminderDaysBefore.join(', ')
                            : '1'}{' '}
                          día(s) antes
                        </p>
                      )}
                    </div>

                    <span className="mt-1 size-2.5 shrink-0 rounded-full bg-cyan-400" />
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            >
              <ChevronLeft className="mr-1 size-4" />
              Anterior
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            >
              Siguiente
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}