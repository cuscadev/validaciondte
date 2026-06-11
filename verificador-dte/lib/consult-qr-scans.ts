import {
  buildInvalidQrResult,
  parseQrScanBatch,
  type ParsedQrScanItem,
} from '@/lib/hacienda-consulta-url';
import {
  consultCodFechaViaGo,
  DEFAULT_CONCURRENCY,
  type ProcessDteOptions,
} from '@/lib/go-dte-api';

export type ConsultQrScansOptions = ProcessDteOptions & {
  fallbackAmbiente?: string;
};

export async function consultQrScansViaGo(
  scans: string[],
  options: ConsultQrScansOptions = {}
) {
  const fallbackAmbiente = options.fallbackAmbiente ?? '01';
  const { valid, invalid } = parseQrScanBatch(scans, fallbackAmbiente);

  const groups = new Map<string, ParsedQrScanItem[]>();
  for (const item of valid) {
    const list = groups.get(item.ambiente) ?? [];
    list.push(item);
    groups.set(item.ambiente, list);
  }

  const consultados: Record<string, unknown>[] = [];
  let total = 0;
  let done = 0;
  let jobId: string | undefined;
  let status: string | undefined;

  for (const [ambiente, items] of groups.entries()) {
    const goResp = await consultCodFechaViaGo(
      items.map((item) => ({ codGen: item.codGen, fechaYmd: item.fechaYmd })),
      {
        ambiente,
        concurrencia: options.concurrencia ?? DEFAULT_CONCURRENCY,
        includeExcel: false,
        enrichCreditNotes: options.enrichCreditNotes ?? true,
        async: options.async ?? false,
      }
    );

    consultados.push(...goResp.resultados);
    total += goResp.total ?? items.length;
    done += goResp.done ?? items.length;
    jobId = goResp.jobId ?? jobId;
    status = goResp.status ?? status;
  }

  return {
    validCount: valid.length,
    invalid,
    consultados,
    resultados: [...invalid, ...consultados] as Record<string, unknown>[],
    total: invalid.length + (total || consultados.length),
    done,
    jobId,
    status,
  };
}

export { buildInvalidQrResult, parseQrScanBatch };
