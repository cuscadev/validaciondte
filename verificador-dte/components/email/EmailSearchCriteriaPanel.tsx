'use client';

import {
  describeEmailSearchCriteria,
  formatEmailSubjectKeywordsList,
} from '@/lib/email/search-criteria';

type Props = {
  dateFrom: string;
  dateTo: string;
  mailboxFolder?: string;
  provider?: 'gmail' | 'yahoo' | 'microsoft' | string;
};

export default function EmailSearchCriteriaPanel({
  dateFrom,
  dateTo,
  mailboxFolder = 'INBOX',
  provider,
}: Props) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <p className="font-medium">Criterios de búsqueda</p>
      <p className="text-muted-foreground">
        {describeEmailSearchCriteria({ dateFrom, dateTo, mailboxFolder, provider })}
      </p>
      <p className="text-xs text-muted-foreground">
        Palabras clave en asunto:{' '}
        <span className="font-medium text-foreground">
          {formatEmailSubjectKeywordsList()}
        </span>
      </p>
      {provider === 'gmail' ? (
        <p className="text-xs text-muted-foreground">
          Gmail aplica filtro de adjuntos JSON y palabras clave directamente en el servidor
          (X-GM-RAW), reduciendo correos descargados.
        </p>
      ) : provider ? (
        <p className="text-xs text-muted-foreground">
          {provider === 'yahoo' ? 'Yahoo' : provider === 'microsoft' ? 'Microsoft' : 'Este proveedor'}{' '}
          busca por rango de fechas y descarta mensajes sin palabras clave en el asunto antes de
          descargar el cuerpo completo.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Solo se importan DTE tipos 01, 03, 05, 06, 11 y 14 con fecha de emisión dentro
        del rango seleccionado.
      </p>
    </div>
  );
}
