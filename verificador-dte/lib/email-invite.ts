export type EmailEntryMode = 'corporate' | 'external';

export function sanitizeLocalPart(value: string): string {
  return value.replace(/@/g, '').replace(/\s/g, '');
}

export function buildCorporateEmail(localPart: string, domain: string): string {
  const local = sanitizeLocalPart(localPart).trim().toLowerCase();
  const d = domain.trim().toLowerCase().replace(/^@+/, '');
  if (!local || !d) return '';
  return `${local}@${d}`;
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at <= 0 || at === normalized.length - 1) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  return local.length > 0 && domain.includes('.');
}

export function defaultEmailEntryMode(domain: string): EmailEntryMode {
  return domain.trim() ? 'corporate' : 'external';
}
