'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchDteJob,
  pollDteJob,
  type GoDteBatchJobStatus,
} from '@/lib/go-dte-api';

type UseDteBatchJobOptions = {
  intervalMs?: number;
  autoStart?: boolean;
};

export function useDteBatchJob(jobId?: string | null, options?: UseDteBatchJobOptions) {
  const intervalMs = options?.intervalMs ?? 1000;
  const [status, setStatus] = useState<GoDteBatchJobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeJobRef = useRef<string | null>(null);

  const poll = useCallback(async (id: string) => {
    activeJobRef.current = id;
    setLoading(true);
    setError(null);
    try {
      const finalStatus = await pollDteJob(id, setStatus, intervalMs);
      setStatus(finalStatus);
      return finalStatus;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error consultando job';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [intervalMs]);

  const refresh = useCallback(async () => {
    if (!jobId) return null;
    const next = await fetchDteJob(jobId);
    setStatus(next);
    return next;
  }, [jobId]);

  useEffect(() => {
    if (!options?.autoStart || !jobId) return;
    poll(jobId).catch(() => {});
  }, [jobId, options?.autoStart, poll]);

  return {
    status,
    loading,
    error,
    poll,
    refresh,
    progressPct:
      status && status.total > 0
        ? Math.min(100, Math.round((status.done / status.total) * 100))
        : 0,
  };
}
