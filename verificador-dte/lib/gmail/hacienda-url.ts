export function isoDateToDMY(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function buildHaciendaPublicUrl(input: {
  ambiente?: string | null;
  codigoGeneracion: string;
  fecEmi: string;
}) {
  const params = new URLSearchParams({
    ambiente: input.ambiente?.trim() || '01',
    codGen: input.codigoGeneracion,
    fechaEmi: isoDateToDMY(input.fecEmi),
  });
  return `https://admin.factura.gob.sv/consultaPublica?${params.toString()}`;
}
