import type { EmailDocumentSortBy, EmailDocumentSortDir } from '@/lib/email-import/documents-api';
import type { GmailCatalogFilters } from '@/components/gmail/GmailDocumentFilters';

export type EmailCatalogSource = 'gmail' | 'imap';

export type EmailCatalogListParams = {
  filters: GmailCatalogFilters;
  page: number;
  pageSize: number;
  sortBy: EmailDocumentSortBy;
  sortDir: EmailDocumentSortDir;
  sourceFilter?: 'imap';
};

export const emailDocumentCatalogKeys = {
  all: ['email-document-catalog'] as const,
  lists: () => [...emailDocumentCatalogKeys.all, 'list'] as const,
  list: (source: EmailCatalogSource, params: EmailCatalogListParams) =>
    [...emailDocumentCatalogKeys.lists(), source, params] as const,
};

export const gmailIntegrationKeys = {
  all: ['gmail-integration'] as const,
  status: () => [...gmailIntegrationKeys.all, 'status'] as const,
};

export const imapIntegrationKeys = {
  all: ['imap-integration'] as const,
  status: () => [...imapIntegrationKeys.all, 'status'] as const,
};

export function catalogQueryParams(input: EmailCatalogListParams) {
  return {
    importStatus: 'imported',
    limit: String(input.pageSize),
    offset: String((input.page - 1) * input.pageSize),
    sortBy: input.sortBy,
    sortDir: input.sortDir,
    source: input.sourceFilter,
    q: input.filters.q.trim() || undefined,
    tipoDte: input.filters.tipoDte || undefined,
    dateFrom: input.filters.dateFrom || undefined,
    dateTo: input.filters.dateTo || undefined,
    mailbox: input.filters.mailbox || undefined,
  };
}
