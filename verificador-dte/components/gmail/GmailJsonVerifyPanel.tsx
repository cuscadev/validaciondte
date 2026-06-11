'use client';

import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { GmailJsonVerifyResult } from '@/lib/gmail/json-verify-result';

type Props = {
  results: GmailJsonVerifyResult[];
  downloadHref: string | null;
  filename: string;
  loading?: boolean;
};

function estadoClass(estado?: string) {
  switch (estado) {
    case 'EMITIDO':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
    case 'ANULADO':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
    case 'RECHAZADO':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}

export default function GmailJsonVerifyPanel({
  results,
  downloadHref,
  filename,
  loading,
}: Props) {
  if (loading) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Verificando JSON importados en Hacienda...
      </p>
    );
  }

  if (!results.length) return null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Resultados de verificacion JSON ({results.length})
        </p>
        {downloadHref && (
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={downloadHref} download={filename}>
              Descargar Excel
            </a>
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400">
              <th className="p-2">Archivo</th>
              <th className="p-2">Codigo</th>
              <th className="p-2">Fec. Emi</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Emisor</th>
              <th className="p-2">Receptor</th>
              <th className="p-2">Total</th>
              <th className="p-2">Error</th>
              <th className="p-2">MH</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => {
              const link = row.linkVisita || row.url;
              return (
                <tr key={`${row.codGen || row.nombreArchivo || index}`} className="border-b border-border/40">
                  <td className="p-2 align-top">{row.nombreArchivo || '—'}</td>
                  <td className="p-2 align-top font-mono text-xs">
                    {row.codGen || row.codigoGeneracion || '—'}
                  </td>
                  <td className="p-2 align-top">{row.fechaEmi || '—'}</td>
                  <td className="p-2 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${estadoClass(row.estado)}`}
                    >
                      {row.estado || '—'}
                    </span>
                    {row.descripcionEstado ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.descripcionEstado}
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-[10rem] p-2 align-top break-words">
                    <div>{row.emisorNombre || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.emisorNit, row.emisorNrc].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="max-w-[10rem] p-2 align-top break-words">
                    <div>{row.receptorNombre || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.receptorNit, row.receptorNrc].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="p-2 align-top">{row.montoTotal || '—'}</td>
                  <td className="max-w-[8rem] p-2 align-top break-words text-xs text-red-600">
                    {row.error || '—'}
                  </td>
                  <td className="p-2 align-top">
                    {link ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={link} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
