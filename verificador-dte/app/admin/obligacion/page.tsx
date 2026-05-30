'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ExternalLink, RefreshCcw, Search, Trash2 } from 'lucide-react';

import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ObligationsCalendar from '@/components/obligations/ObligationsCalendar';

const TAX_CALENDAR_URL =
  'https://www.mh.gob.sv/wp-content/uploads/2025/12/Calendario-Tributario-2026.pdf';

type UserOption = {
  uid: string;
  docId?: string;
  firebaseUid?: string;
  email?: string;
  displayName?: string;
  role?: string;
};

type Obligation = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  category?: string;
  status?: string;
  targetMode?: 'all' | 'role' | 'selected';
  targetRole?: string | null;
  targetUids?: string[];
  notifyClient?: boolean;
  reminderDaysBefore?: number[];
};

export default function AdminObligacionPage() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    category: 'Tributario',
    targetMode: 'role',
    reminderDaysBefore: '1',
    notifyClient: true,
  });

  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['admin-obligation-users'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/admin/obligacion?mode=users&role=cliente', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar los clientes');

      return data.users as UserOption[];
    },
  });

  const obligationsQuery = useQuery({
    queryKey: ['admin-obligations'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/admin/obligacion', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar las obligaciones');

      return data.obligations as Obligation[];
    },
  });

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase();
    const users = usersQuery.data ?? [];

    if (!value) return users;

    return users.filter((user) => {
      const name = user.displayName?.toLowerCase() ?? '';
      const email = user.email?.toLowerCase() ?? '';
      const uid = user.uid?.toLowerCase() ?? '';

      return name.includes(value) || email.includes(value) || uid.includes(value);
    });
  }, [usersQuery.data, search]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (name === 'targetMode') {
      setSelectedUids([]);
      setSearch('');
    }
  };

  const toggleUser = (uid: string) => {
    setSelectedUids((current) =>
      current.includes(uid)
        ? current.filter((item) => item !== uid)
        : [...current, uid]
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (!form.title.trim()) {
      setMessage('El título es obligatorio.');
      return;
    }

    if (!form.dueDate) {
      setMessage('La fecha de vencimiento es obligatoria.');
      return;
    }

    if (form.targetMode === 'selected' && selectedUids.length === 0) {
      setMessage('Selecciona al menos un cliente.');
      return;
    }

    setSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const reminderDaysBefore = form.reminderDaysBefore
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item) && item >= 0);

      const payload =
        form.targetMode === 'selected'
          ? {
              title: form.title.trim(),
              description: form.description.trim(),
              dueDate: form.dueDate,
              category: form.category,
              targetMode: 'selected',
              targetUids: selectedUids,
              notifyClient: form.notifyClient,
              reminderDaysBefore,
            }
          : {
              title: form.title.trim(),
              description: form.description.trim(),
              dueDate: form.dueDate,
              category: form.category,
              targetMode: 'role',
              targetRole: 'cliente',
              targetUids: [],
              notifyClient: form.notifyClient,
              reminderDaysBefore,
            };

      const res = await fetch('/api/admin/obligacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear la obligación');

      setForm({
        title: '',
        description: '',
        dueDate: '',
        category: 'Tributario',
        targetMode: 'role',
        reminderDaysBefore: '1',
        notifyClient: true,
      });

      setSelectedUids([]);
      setSearch('');
      setMessage('Obligación creada correctamente.');

      await queryClient.invalidateQueries({ queryKey: ['admin-obligations'] });
      await queryClient.invalidateQueries({ queryKey: ['tributario-calendar'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error creando obligación.');
    } finally {
      setSaving(false);
    }
  };

  const deleteObligation = async (id: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    const res = await fetch(`/api/admin/obligacion?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      await queryClient.invalidateQueries({ queryKey: ['admin-obligations'] });
      await queryClient.invalidateQueries({ queryKey: ['tributario-calendar'] });
    }
  };

  const obligations = obligationsQuery.data ?? [];

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-yellow-400 text-black">
              <CalendarDays className="size-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Gestión de obligaciones tributarias
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Crea obligaciones para todos los clientes o selecciona clientes específicos.
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

      <section className="grid gap-4 xl:grid-cols-[440px_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
        >
          <h2 className="text-base font-bold text-slate-950 dark:text-white">
            Nueva obligación
          </h2>

          <div className="mt-4 space-y-3">
            <Input name="title" value={form.title} onChange={handleChange} placeholder="Título" />

            <Input
              type="date"
              name="dueDate"
              value={form.dueDate}
              onChange={handleChange}
            />

            <Input
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="Categoría"
            />

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Descripción"
            />

            <select
              name="targetMode"
              value={form.targetMode}
              onChange={handleChange}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="role">Todos los clientes</option>
              <option value="selected">Clientes seleccionados</option>
            </select>

            <Input
              name="reminderDaysBefore"
              value={form.reminderDaysBefore}
              onChange={handleChange}
              placeholder="Recordar días antes. Ej: 1,3,5"
            />

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={form.notifyClient}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notifyClient: event.target.checked,
                  }))
                }
              />
              Enviar recordatorio por notificación
            </label>

            {form.targetMode === 'selected' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                  Clientes seleccionados: {selectedUids.length}
                </p>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar cliente"
                    className="pl-9"
                  />
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {filteredUsers.map((user) => {
                    const active = selectedUids.includes(user.uid);

                    return (
                      <button
                        key={user.uid}
                        type="button"
                        onClick={() => toggleUser(user.uid)}
                        className={`w-full rounded-lg border p-3 text-left text-sm ${
                          active
                            ? 'border-yellow-400 bg-yellow-400/10'
                            : 'border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-950'
                        }`}
                      >
                        <p className="font-semibold text-slate-950 dark:text-white">
                          {user.displayName || user.email || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {user.email || user.uid}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {message && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-black">
                {message}
              </div>
            )}

            <Button type="submit" disabled={saving} className="w-full bg-yellow-400 text-black hover:bg-yellow-300">
              {saving ? 'Guardando...' : 'Crear obligación'}
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <ObligationsCalendar />

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">
                Obligaciones registradas
              </h2>

              <Button
                type="button"
                variant="outline"
                onClick={() => obligationsQuery.refetch()}
              >
                <RefreshCcw className="mr-2 size-4" />
                Actualizar
              </Button>
            </div>

            <div className="space-y-3">
              {obligations.map((item) => (
                <article
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Vence: {item.dueDate} ·{' '}
                      {item.targetMode === 'selected'
                        ? `${item.targetUids?.length ?? 0} cliente(s)`
                        : 'Todos los clientes'}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => deleteObligation(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}