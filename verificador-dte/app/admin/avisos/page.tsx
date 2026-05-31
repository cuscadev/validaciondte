'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { AppNotification } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

const NOTIFICATION_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'access_request', label: 'Solicitud de acceso' },
  { value: 'membership_expiring', label: 'Membresía próxima a expirar' },
  { value: 'admin_message', label: 'Mensaje administrativo' },
];

const TARGET_ROLES = [
  { value: 'all', label: 'Todos los usuarios' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'colaborador', label: 'Colaboradores' },
  { value: 'superadmin', label: 'Superadministradores' },
];

type UserOption = {
  uid: string;
  docId?: string;
  firebaseUid?: string;
  email?: string;
  displayName?: string;
  role?: string;
};

type NotificationWithMeta = AppNotification & {
  id: string;
  readBy?: string[];
  targetUid?: string;
  targetRole?: string;
  metadata?: {
    targetUserEmail?: string | null;
    targetUserName?: string | null;
    targetRoleSelected?: string | null;
  };
};

function formatDate(createdAt?: { seconds: number; nanoseconds?: number }) {
  if (!createdAt) return '-';
  return new Date(createdAt.seconds * 1000).toLocaleString();
}

export default function AvisosAdminPage() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    type: 'general',
    title: '',
    body: '',
    targetRole: 'all',
    targetUid: '',
  });

  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || 'No se pudieron cargar las notificaciones');
      }

      const data = (await res.json()) as {
        notifications: NotificationWithMeta[];
      };

      return data.notifications;
    },
  });

  const usersQuery = useQuery({
    queryKey: ['notification-users', form.targetRole],
    enabled: form.targetRole !== 'all',
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch(
        `/api/notifications?mode=users&role=${form.targetRole}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || 'No se pudieron cargar los usuarios');
      }

      const data = (await res.json()) as {
        users: UserOption[];
      };

      return data.users;
    },
  });

  const notifications = notificationsQuery.data ?? [];

  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));

  const paginatedNotifications = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return notifications.slice(start, start + pageSize);
  }, [notifications, page, pageSize, totalPages]);

  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    const search = userSearch.trim().toLowerCase();

    if (!search) return users;

    return users.filter((user) => {
      const name = user.displayName?.toLowerCase() ?? '';
      const email = user.email?.toLowerCase() ?? '';
      const uid = user.uid?.toLowerCase() ?? '';
      const docId = user.docId?.toLowerCase() ?? '';

      return (
        name.includes(search) ||
        email.includes(search) ||
        uid.includes(search) ||
        docId.includes(search)
      );
    });
  }, [usersQuery.data, userSearch]);

  const selectedUser = useMemo(() => {
    return (usersQuery.data ?? []).find((user) => user.uid === form.targetUid);
  }, [usersQuery.data, form.targetUid]);

  const currentUserUid = auth.currentUser?.uid;

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setForm((current) => {
      if (name === 'targetRole') {
        return {
          ...current,
          targetRole: value,
          targetUid: '',
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });

    if (name === 'targetRole') {
      setUserSearch('');
    }
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(event.target.value));
    setPage(1);
  };

  const markAsRead = async (notificationId: string) => {
    setMarkingId(notificationId);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || 'No se pudo marcar como leída');
      }

      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo marcar como leída.'
      );
    } finally {
      setMarkingId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim() || !form.body.trim()) {
      toast.warning('Título y mensaje son obligatorios.');
      return;
    }

    if (form.targetRole !== 'all' && !form.targetUid.trim()) {
      toast.warning('Selecciona un usuario del listado.');
      return;
    }

    setSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const payload =
        form.targetRole === 'all'
          ? {
              type: form.type,
              title: form.title.trim(),
              body: form.body.trim(),
              targetRole: 'all',
            }
          : {
              type: form.type,
              title: form.title.trim(),
              body: form.body.trim(),
              targetUid: form.targetUid,
              metadata: {
                targetRoleSelected: form.targetRole,
                targetUserEmail: selectedUser?.email ?? null,
                targetUserName: selectedUser?.displayName ?? null,
              },
            };

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear el aviso.');
      }

      setForm({
        type: 'general',
        title: '',
        body: '',
        targetRole: 'all',
        targetUid: '',
      });

      setUserSearch('');
      setPage(1);

      await queryClient.invalidateQueries({
        queryKey: ['notifications'],
      });

      toast.success('Aviso creado correctamente.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error creando el aviso.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 p-0">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
                <Bell className="size-4" />
                Avisos
              </p>

              <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                Crear y gestionar avisos para usuarios
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 md:text-base dark:text-zinc-300">
                Envía avisos a todos los usuarios o selecciona clientes,
                colaboradores o superadministradores desde un listado.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                  Total
                </p>
                <p className="mt-2 text-2xl font-bold">{notifications.length}</p>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Avisos cargados
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                  Estado
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {notificationsQuery.isFetching ? 'Actualizando...' : 'Al día'}
                </p>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Última consulta
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[460px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Crear aviso</CardTitle>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Tipo de aviso
                  </label>

                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {NOTIFICATION_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Título
                  </label>

                  <Input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Ej. Nueva funcionalidad"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Mensaje
                  </label>

                  <textarea
                    name="body"
                    value={form.body}
                    onChange={handleChange}
                    rows={5}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:bg-zinc-950 dark:text-white"
                    placeholder="Describe el aviso que verán los usuarios"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Enviar a
                  </label>

                  <select
                    name="targetRole"
                    value={form.targetRole}
                    onChange={handleChange}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {TARGET_ROLES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {form.targetRole !== 'all' && (
                  <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          Seleccionar usuario
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          El aviso se enviará únicamente al usuario seleccionado.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          queryClient.invalidateQueries({
                            queryKey: ['notification-users', form.targetRole],
                          })
                        }
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Recargar
                      </Button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <Input
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        placeholder="Buscar por nombre, correo o UID"
                        className="pl-9"
                      />
                    </div>

                    {usersQuery.isLoading ? (
                      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-500 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400">
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                        Cargando usuarios...
                      </div>
                    ) : usersQuery.isError ? (
                      <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                        {usersQuery.error instanceof Error
                          ? usersQuery.error.message
                          : 'No se pudieron cargar los usuarios.'}
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-500 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400">
                        No hay usuarios para este filtro.
                      </div>
                    ) : (
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {filteredUsers.map((user) => {
                          const active = form.targetUid === user.uid;

                          return (
                            <button
                              key={user.uid}
                              type="button"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  targetUid: user.uid,
                                }))
                              }
                              className={`w-full rounded-lg border p-3 text-left transition ${
                                active
                                  ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500 dark:border-yellow-400 dark:bg-yellow-400/10 dark:ring-yellow-400'
                                  : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/60 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-yellow-400/70 dark:hover:bg-yellow-400/10'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {user.displayName || 'Sin nombre'}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                    {user.email || 'Sin correo'}
                                  </p>

                                  <p className="mt-1 break-all text-[11px] text-slate-400 dark:text-zinc-500">
                                    UID: {user.uid}
                                  </p>
                                </div>

                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {user.role || form.targetRole}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {selectedUser && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-200">
                        Seleccionado:{' '}
                        {selectedUser.displayName ||
                          selectedUser.email ||
                          selectedUser.uid}
                      </div>
                    )}
                  </section>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Enviando...' : 'Enviar aviso'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      queryClient.invalidateQueries({
                        queryKey: ['notifications'],
                      })
                    }
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Actualizar lista
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Últimos avisos</CardTitle>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-zinc-400">
                    Mostrar
                  </span>

                  <select
                    value={pageSize}
                    onChange={handlePageSizeChange}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>

                  <span className="text-sm text-slate-500 dark:text-zinc-400">
                    registros
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {notificationsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  Cargando avisos...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No hay avisos publicados.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedNotifications.map((notif) => {
                      const isRead = currentUserUid
                        ? notif.readBy?.includes(currentUserUid)
                        : false;

                      return (
                        <div
                        key={notif.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-950"
                        >
                        
                          <div className="flex items-start justify-between gap-3">
                            <div>
                            <div className="flex items-center gap-2">
                            {!isRead && (
                                <span
                                className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                                title="No leído"
                                />
                            )}

                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {notif.title}
                            </p>
                            </div>

                              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
                                {notif.type}
                              </p>
                            </div>

                            <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold uppercase text-slate-700 dark:bg-zinc-800 dark:text-slate-200">
                              {notif.targetUid
                                ? 'Usuario'
                                : notif.targetRole ?? 'all'}
                            </span>
                          </div>

                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                            {notif.body}
                          </p>

                          {notif.metadata?.targetUserEmail && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                              Destinatario: {notif.metadata.targetUserName || 'Usuario'} —{' '}
                              {notif.metadata.targetUserEmail}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-500">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>Creado: {formatDate(notif.createdAt)}</span>
                              <span>Leído por: {notif.readBy?.length ?? 0}</span>
                              {notif.link && (
                                <span className="text-primary">Link adjunto</span>
                              )}
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant={isRead ? 'outline' : 'default'}
                              disabled={isRead || markingId === notif.id}
                              onClick={() => markAsRead(notif.id)}
                            >
                              {markingId === notif.id ? (
                                <>
                                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                                  Marcando...
                                </>
                              ) : isRead ? (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  Leída
                                </>
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  Marcar como leída
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      Página {Math.min(page, totalPages)} de {totalPages} —{' '}
                      {notifications.length} avisos en total
                    </p>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() =>
                          setPage((current) => Math.max(1, current - 1))
                        }
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Anterior
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() =>
                          setPage((current) => Math.min(totalPages, current + 1))
                        }
                      >
                        Siguiente
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}