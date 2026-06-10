'use client';

import DteJsonResultsTable from '@/components/dte/DteJsonResultsTable';
import { BouncingDotsLoader } from '@/components/ui/bouncing-dots-loader';
import type { DteJsonResultado } from '@/lib/dte-json-result';

type Props = {
  results: DteJsonResultado[];
  loading?: boolean;
};

export default function EmailJsonVerifyPanel({ results, loading }: Props) {
  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Consultando en Hacienda"
        className="flex flex-col items-center justify-center gap-3 py-10"
      >
        <BouncingDotsLoader size="md" label="Consultando en Hacienda" />
        <p className="text-sm font-medium text-muted-foreground">Consultando en Hacienda…</p>
      </div>
    );
  }

  if (!results.length) return null;

  return (
    <DteJsonResultsTable
      results={results}
      loading={loading}
      profile="email"
      showFileColumn
    />
  );
}
