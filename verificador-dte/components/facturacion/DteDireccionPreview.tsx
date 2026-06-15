import { buildDteDireccionPreview } from '@/lib/facturacion/location-catalog-options';

type Props = {
  departamentoCodigo: string;
  municipioCodigo: string;
  distritoCodigo: string;
  complemento?: string;
  className?: string;
};

export function DteDireccionPreview({
  departamentoCodigo,
  municipioCodigo,
  distritoCodigo,
  complemento,
  className,
}: Props) {
  const preview = buildDteDireccionPreview(
    departamentoCodigo,
    municipioCodigo,
    distritoCodigo,
    complemento
  );

  if (!preview) return null;

  return (
    <div
      className={[
        'rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="font-medium text-foreground">JSON direccion (Hacienda)</p>
      <p className="mt-1 text-[10px] leading-snug">
        Municipio = codigo CAT-013 del catalogo (columna codigo). Distrito = sufijo DTE del codigo
        CAT-008 (2 digitos).
      </p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
        {JSON.stringify(
          {
            departamento: preview.departamento,
            municipio: preview.municipio,
            distrito: preview.distrito || '—',
            complemento: preview.complemento || '—',
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
