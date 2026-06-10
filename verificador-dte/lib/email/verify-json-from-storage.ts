import { getGoDteApiUrl } from '@/lib/go-dte-api';
import {
  documentHasJsonContent,
  getDocumentJsonBuffer,
  getDocumentsByIds,
} from '@/lib/email/db';
import type { GmailJsonVerifyResult } from '@/lib/gmail/json-verify-result';

export const EMAIL_JSON_VERIFY_BATCH_SIZE = 25;

/** Verifica DTEs usando json_content en Postgres (o storage_path legacy). */
export async function verifyEmailDocuments(input: {
  organizationId: string;
  documentIds: string[];
}): Promise<{ resultados: GmailJsonVerifyResult[]; processedCount: number }> {
  const documents = await getDocumentsByIds(
    input.organizationId,
    input.documentIds.slice(0, EMAIL_JSON_VERIFY_BATCH_SIZE)
  );

  const imported = documents.filter(
    (doc) => doc.import_status === 'imported' && documentHasJsonContent(doc)
  );

  if (!imported.length) {
    throw new Error(
      'Ningun documento seleccionado tiene JSON importado disponible.'
    );
  }

  const allResults: GmailJsonVerifyResult[] = [];

  for (let index = 0; index < imported.length; index += EMAIL_JSON_VERIFY_BATCH_SIZE) {
    const batch = imported.slice(index, index + EMAIL_JSON_VERIFY_BATCH_SIZE);
    const formData = new FormData();

    for (const doc of batch) {
      const buffer = await getDocumentJsonBuffer(doc);
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/json' });
      formData.append('files', blob, doc.file_name || `${doc.id}.json`);
    }

    const upstream = await fetch(`${getGoDteApiUrl()}/api/verificararchjson`, {
      method: 'POST',
      body: formData,
    });

    if (!upstream.ok) {
      const message = await upstream.text();
      throw new Error(message || 'Error al verificar JSON en Hacienda.');
    }

    const payload = (await upstream.json()) as { resultados?: GmailJsonVerifyResult[] };
    allResults.push(...(payload.resultados || []));
  }

  return { resultados: allResults, processedCount: imported.length };
}

/** @deprecated Alias historico; prioriza json_content en BD. */
export const verifyEmailDocumentsFromStorage = verifyEmailDocuments;
