const LOCALE = 'es-SV';

export const YEAR_MIN = 2010;
export const YEAR_MAX = new Date().getFullYear() + 1;
export const YEARS_PER_PAGE = 12;

const monthLabelFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
const monthShortFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const weekdayShortFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' });

export function clampYear(year: number) {
  return Math.min(YEAR_MAX, Math.max(YEAR_MIN, year));
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function setYear(date: Date, year: number) {
  return new Date(clampYear(year), date.getMonth(), 1);
}

export function setMonth(date: Date, month: number) {
  return new Date(date.getFullYear(), month, 1);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function formatMonthLabel(date: Date) {
  const label = monthLabelFmt.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMonthShort(date: Date) {
  const label = monthShortFmt.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
}

export function formatWeekdayShort(date: Date) {
  return weekdayShortFmt.format(date).replace('.', '');
}

export function getWeekdayLabels(): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    formatWeekdayShort(new Date(2024, 0, 1 + i))
  );
}

export function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  while (rows.length < 6) {
    rows.push(Array.from({ length: 7 }, () => null));
  }
  return rows;
}

export function buildYearPageStart(year: number) {
  const clamped = clampYear(year);
  const offset = clamped - YEAR_MIN;
  const pageIndex = Math.floor(offset / YEARS_PER_PAGE);
  return YEAR_MIN + pageIndex * YEARS_PER_PAGE;
}

export function buildYearPage(startYear: number) {
  const start = clampYear(startYear);
  const aligned = buildYearPageStart(start);
  return Array.from({ length: YEARS_PER_PAGE }, (_, i) => aligned + i).filter(
    (y) => y >= YEAR_MIN && y <= YEAR_MAX
  );
}

export function formatYearRange(startYear: number) {
  const years = buildYearPage(startYear);
  if (!years.length) return String(startYear);
  return `${years[0]} – ${years[years.length - 1]}`;
}

export function canGoPrevYearPage(startYear: number) {
  return buildYearPageStart(startYear) > YEAR_MIN;
}

export function canGoNextYearPage(startYear: number) {
  return buildYearPageStart(startYear) + YEARS_PER_PAGE <= YEAR_MAX;
}

export function prevYearPageStart(startYear: number) {
  return Math.max(YEAR_MIN, buildYearPageStart(startYear) - YEARS_PER_PAGE);
}

export function nextYearPageStart(startYear: number) {
  return Math.min(
    buildYearPageStart(YEAR_MAX),
    buildYearPageStart(startYear) + YEARS_PER_PAGE
  );
}

export function monthIndexList() {
  return Array.from({ length: 12 }, (_, month) => month);
}
