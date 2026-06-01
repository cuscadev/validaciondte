export const GMAIL_VERIFY_BATCH_KEY = 'gmail-verify-batch';

export type VerifyBatchItem = {
  codGen: string;
  fechaEmi: string;
};

export function isoDateToDMY(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function storeVerifyBatch(items: VerifyBatchItem[]) {
  sessionStorage.setItem(GMAIL_VERIFY_BATCH_KEY, JSON.stringify(items));
}

export function consumeVerifyBatch(): VerifyBatchItem[] {
  const raw = sessionStorage.getItem(GMAIL_VERIFY_BATCH_KEY);
  if (!raw) return [];
  sessionStorage.removeItem(GMAIL_VERIFY_BATCH_KEY);
  try {
    const parsed = JSON.parse(raw) as VerifyBatchItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function documentsToVerifyBatch(
  docs: Array<{ codigo_generacion: string | null; fec_emi: string | null }>
): VerifyBatchItem[] {
  return docs
    .filter((d) => d.codigo_generacion && d.fec_emi)
    .map((d) => ({
      codGen: d.codigo_generacion!,
      fechaEmi: isoDateToDMY(d.fec_emi!),
    }));
}
