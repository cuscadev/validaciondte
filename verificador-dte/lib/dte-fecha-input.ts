export const FECHA_DMY_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

export function formatFechaInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = dd;
  if (mm) out += `/${mm}`;
  if (yyyy) out += `/${yyyy}`;
  return out;
}

export function dateToDmy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function dmyToDate(fecha: string): Date | undefined {
  if (!FECHA_DMY_REGEX.test(fecha.trim())) return undefined;
  const [dd, mm, yyyy] = fecha.split('/').map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return undefined;
  }
  return date;
}
