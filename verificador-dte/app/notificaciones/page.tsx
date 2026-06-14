'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { AppNotification, markNotificationRead } from '@/lib/notifications';
import { useGetQuery } from '@/lib/tanstack-query';
import { cn } from '@/lib/utils';

type NotificationsResponse = {
  notifications: AppNotification[];
};

const NOTIFICATIONS_QUERY_KEY = ['notifications', 'me'] as const;

function getCreatedAtMs(createdAt?: AppNotification['createdAt']) {
  if (!createdAt) return 0;
  return Number(createdAt.seconds || 0) * 1000;
}

function formatDateTime(createdAt?: AppNotification['createdAt']) {
  const ms = getCreatedAtMs(createdAt);
  if (!ms) return 'Sin fecha';
  return new Date(ms).toLocaleString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(createdAt?: AppNotification['createdAt']) {
  const seconds = Math.floor((Date.now() - getCreatedAtMs(createdAt)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86400)} d`;
}

function getTypeLabel(type: AppNotification['type']) {
  switch (type) {
    case 'access_request':
      return 'Solicitud';
    case 'membership_expiring':
      return 'Membresia';
    case 'admin_message':
      return 'Aviso';
    default:
      return 'General';
  }
}

export default function NotificationsPage() {
  const { firebaseUser, authChecked } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notificationsQuery = useGetQuery<NotificationsResponse, AppNotification[]>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    path: '/api/notifications',
    params: { scope: 'me' },
    enabled: authChecked && Boolean(firebaseUser),
    overrides: {
      select: (data) => data.notifications ?? [],
    },
  });

  const notifications = notificationsQuery.data ?? [];
  const unread = useMemo(
    () => notifications.filter((notification) => !notification.readBy?.includes(firebaseUser?.uid ?? '')),
    [firebaseUser?.uid, notifications]
  );
  const visibleNotifications =
    filter === 'unread' ? unread : notifications;

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await markNotificationRead(notificationId, firebaseUser?.uid ?? '');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo marcar como leida');
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        unread.map((notification) =>
          markNotificationRead(notification.id, firebaseUser?.uid ?? '')
        )
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      toast.success('Notificaciones marcadas como leidas');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudieron marcar como leidas');
    },
  });

  const loading = notificationsQuery.isPending && !notificationsQuery.data;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex w-full flex-col gap-4 p-0">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-primary text-primary">
                <Bell className="size-4" />
                Centro de notificaciones
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                Notificaciones
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                Revisa los avisos enviados a tu cuenta y marca como leido lo que ya atendiste.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[24rem]">
              <SummaryCard label="Total" value={notifications.length} />
              <SummaryCard label="Sin leer" value={unread.length} accent />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                Todas ({notifications.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filter === 'unread' ? 'default' : 'outline'}
                onClick={() => setFilter('unread')}
              >
                Sin leer ({unread.length})
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => notificationsQuery.refetch()}
                disabled={notificationsQuery.isFetching}
              >
                <RefreshCw className={cn('size-4', notificationsQuery.isFetching && 'animate-spin')} />
                Actualizar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-primary font-bold text-black hover:bg-primary/90"
                onClick={() => markAllReadMutation.mutate()}
                disabled={unread.length === 0 || markAllReadMutation.isPending}
              >
                <CheckCheck className="size-4" />
                Marcar todas leidas
              </Button>
            </div>
          </div>

          {notificationsQuery.error ? (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {notificationsQuery.error.message}
            </div>
          ) : null}

          {loading ? (
            <NotificationsSkeleton />
          ) : visibleNotifications.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {visibleNotifications.map((notification) => {
                const isUnread = !notification.readBy?.includes(firebaseUser?.uid ?? '');
                return (
                  <article
                    key={notification.id}
                    className={cn(
                      'grid gap-3 p-4 transition hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-start',
                      isUnread && 'bg-primary/5'
                    )}
                  >
                    <div className="flex min-w-0 gap-3">
                      <div
                        className={cn(
                          'mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg border',
                          isUnread
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-muted text-muted-foreground'
                        )}
                      >
                        <Bell className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                            {getTypeLabel(notification.type)}
                          </span>
                          {isUnread ? (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-200">
                              Sin leer
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                              Leida
                            </span>
                          )}
                        </div>
                        <h2 className="mt-2 text-base font-bold md:text-lg">
                          {notification.title}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {notification.body}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {timeAgo(notification.createdAt)}
                          </span>
                          <span>{formatDateTime(notification.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {notification.link ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={notification.link}>
                            <ExternalLink className="size-4" />
                            Abrir
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant={isUnread ? 'default' : 'outline'}
                        disabled={!isUnread || markReadMutation.isPending}
                        onClick={() => markReadMutation.mutate(notification.id)}
                      >
                        <Check className="size-4" />
                        Marcar leida
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-3xl font-extrabold', accent && 'text-primary text-primary')}>
        {value}
      </p>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="divide-y divide-slate-200 dark:divide-white/10">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="flex gap-3">
            <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-5 w-3/5 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="flex gap-2 md:justify-end">
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filter }: { filter: 'all' | 'unread' }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Inbox className="size-7" />
      </div>
      <h2 className="mt-4 text-lg font-bold">
        {filter === 'unread' ? 'No tienes notificaciones sin leer' : 'Sin notificaciones'}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {filter === 'unread'
          ? 'Todo lo recibido ya esta marcado como leido.'
          : 'Cuando recibas avisos personales o por rol apareceran aqui.'}
      </p>
    </div>
  );
}
