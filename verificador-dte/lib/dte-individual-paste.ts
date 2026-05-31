const UUID_HEX_REGEX =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

function toDMY(fecha: string) {
  const t = (fecha || '').trim().replace(/-/g, '/');
  const dmY = /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/;
  if (!dmY.test(t)) return '';
  const [dd, mm, yyyy] = t.replace(/-/g, '/').split('/');
  return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
}

function guessSeparator(line: string): string | RegExp {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  if (line.includes(',')) return ',';
  return /\s{2,}/;
}

export function parsePastedItems(
  texto: string,
  maxItems: number
): Array<{ codGen: string; fechaEmi: string }> {
  const out: Array<{ codGen: string; fechaEmi: string }> = [];
  const lines = (texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/c[oó]d/i.test(line) && /fecha/i.test(line)) continue;
    const sep = guessSeparator(line);
    const cells = typeof sep === 'string' ? line.split(sep) : line.split(sep);
    if (!cells.length) continue;

    let codGen = '';
    let fechaEmi = '';

    for (const cRaw of cells) {
      const c = cRaw.trim();
      if (!codGen && UUID_HEX_REGEX.test(c)) codGen = c;
      if (!fechaEmi && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(c)) fechaEmi = toDMY(c);
    }

    if ((!codGen || !fechaEmi) && cells.length >= 2) {
      const a = (cells[0] || '').trim();
      const b = (cells[1] || '').trim();
      if (!codGen && UUID_HEX_REGEX.test(a)) codGen = a;
      if (!codGen && UUID_HEX_REGEX.test(b)) codGen = b;
      if (!fechaEmi && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(a)) fechaEmi = toDMY(a);
      if (!fechaEmi && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(b)) fechaEmi = toDMY(b);
    }

    if (codGen && fechaEmi) out.push({ codGen, fechaEmi });
    if (out.length >= maxItems) break;
  }
  return out.slice(0, maxItems);
}

export const UUID_REGEX = UUID_HEX_REGEX;
