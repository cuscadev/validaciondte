'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import type { LimitNoticeStatus } from '@/lib/usage-limits';

type NoticeState = {
  loading: boolean;
  status: LimitNoticeStatus | null;
  error: string | null;
  accepted: boolean;
  saving: boolean;
};

export function useProcessLimitNotice(routeKey: string, enabled: boolean) {
  const { firebaseUser, appUser, refreshAppUser } = useAuth();
  const [state, setState] = useState<NoticeState>({
    loading: enabled,
    status: null,
    error: null,
    accepted: false,
    saving: false,
  });

  const loadStatus = useCallback(async () => {
    if (!enabled || !firebaseUser || appUser?.role === 'superadmin') {
      setState({
        loading: false,
        status: null,
        error: null,
        accepted: true,
        saving: false,
      });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const token = await (firebaseUser || auth.currentUser)?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch(
        `/api/usage-limits/notice-status?routeKey=${encodeURIComponent(routeKey)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      const json = (await res.json()) as LimitNoticeStatus & { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar el aviso de limites');

      setState({
        loading: false,
        status: json,
        error: null,
        accepted: !json.requiresAcknowledgment,
        saving: false,
      });
    } catch (error) {
      setState({
        loading: false,
        status: null,
        error: error instanceof Error ? error.message : 'Error cargando aviso',
        accepted: false,
        saving: false,
      });
    }
  }, [appUser?.role, enabled, firebaseUser, routeKey]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const acknowledge = useCallback(async () => {
    if (!firebaseUser || !state.status) return false;

    setState((current) => ({ ...current, saving: true, error: null }));

    try {
      const token = await (firebaseUser || auth.currentUser)?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/usage-limits/notice-ack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ routeKey }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar la aceptacion');

      await refreshAppUser();
      setState((current) => ({
        ...current,
        accepted: true,
        saving: false,
        status: current.status
          ? { ...current.status, requiresAcknowledgment: false }
          : current.status,
      }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : 'Error al aceptar',
      }));
      return false;
    }
  }, [firebaseUser, refreshAppUser, routeKey, state.status]);

  const requiresAcknowledgment =
    enabled &&
    !state.loading &&
    !state.accepted &&
    Boolean(state.status?.requiresAcknowledgment);

  return {
    ...state,
    requiresAcknowledgment,
    acknowledge,
    reload: loadStatus,
  };
}
