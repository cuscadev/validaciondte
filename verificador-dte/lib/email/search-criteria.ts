export const EMAIL_SUBJECT_KEYWORDS = [
  'factura',
  'credito fiscal',
  'crédito fiscal',
  'nota de credito',
  'nota de crédito',
  'nota de debito',
  'nota de débito',
  'dte',
  'ccf',
] as const;

export const EMAIL_SUBJECT_KEYWORDS_DISPLAY = [
  'factura',
  'crédito fiscal',
  'nota de crédito',
  'nota de débito',
  'DTE',
  'CCF',
] as const;

function normalizeSubject(subject: string): string {
  return subject
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function matchesEmailSubject(subject: string | null | undefined): boolean {
  if (!subject?.trim()) return false;
  const normalized = normalizeSubject(subject);
  return EMAIL_SUBJECT_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeSubject(keyword))
  );
}

export function describeEmailSearchCriteria(input: {
  dateFrom: string;
  dateTo: string;
  mailboxFolder?: string;
  provider?: 'gmail' | 'yahoo' | 'microsoft' | string;
}): string {
  const folder = input.mailboxFolder || 'INBOX';
  const keywords = EMAIL_SUBJECT_KEYWORDS_DISPLAY.join(', ');
  if (input.provider === 'gmail') {
    return `Mensajes en ${folder} entre ${input.dateFrom} y ${input.dateTo} con adjuntos .json. Gmail usa búsqueda nativa (X-GM-RAW) con palabras clave: ${keywords}.`;
  }
  return `Mensajes en ${folder} entre ${input.dateFrom} y ${input.dateTo} con adjuntos .json cuyo asunto contenga: ${keywords}. Yahoo/Microsoft filtran por asunto tras leer el sobre del mensaje (sin descargar el cuerpo completo).`;
}

export function formatEmailSubjectKeywordsList(): string {
  return EMAIL_SUBJECT_KEYWORDS_DISPLAY.join(' · ');
}
