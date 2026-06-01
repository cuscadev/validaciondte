export {
  ALLOWED_TIPO_DTE,
  TIPO_DTE_LABELS,
  isAllowedTipoDte,
  isDateInRange,
  isJsonAttachment,
  normalizeDate,
  parseDteForImport,
  parseDteFromObject,
  parseDteJsonFields,
  resolveDteItem,
  extractRelatedDocuments,
  type ParsedDteImport,
  type RelatedDocumentRef,
} from '@/lib/gmail/parse-dte-import';

export type ParsedDteFields = {
  codGen: string;
  fechaYMD: string;
};
