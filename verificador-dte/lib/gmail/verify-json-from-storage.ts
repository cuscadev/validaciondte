import { getGoDteApiUrl } from '@/lib/go-dte-api';
import {
  downloadDocumentJson,
  getDocumentsByIds,
} from '@/lib/email-import/documents-api';
import type { GmailJsonVerifyResult } from '@/lib/gmail/json-verify-result';

export const GMAIL_JSON_VERIFY_BATCH_SIZE = 25;

export async function verifyGmailDocumentsFromStorage(input: {
  organizationId: string;
  documentIds: string[];
}): Promise<{ resultados: GmailJsonVerifyResult[]; processedCount: number }> {
  const documents = await getDocumentsByIds(
    input.organizationId,
    input.documentIds.slice(0, GMAIL_JSON_VERIFY_BATCH_SIZE)
  );

  const imported = documents.filter(
    (doc) => doc.import_status === 'imported' && doc.storage_path
  );

  if (!imported.length) {
    throw new Error(
      'Ningun documento seleccionado tiene JSON importado en almacenamiento.'
    );
  }

  const allResults: GmailJsonVerifyResult[] = [];

  for (let index = 0; index < imported.length; index += GMAIL_JSON_VERIFY_BATCH_SIZE) {
    const batch = imported.slice(index, index + GMAIL_JSON_VERIFY_BATCH_SIZE);
    const formData = new FormData();

    for (const doc of batch) {
      const buffer = await downloadDocumentJson(doc.id, input.organizationId);
      if (!buffer) continue;
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
