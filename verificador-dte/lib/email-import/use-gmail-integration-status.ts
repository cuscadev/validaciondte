'use client';

import { useGetQuery } from '@/lib/tanstack-query';
import { gmailIntegrationKeys } from '@/lib/email-import/query-keys';

export type GmailIntegrationStatus = {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
  lastSync: {
    id: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    importedCount: number;
  } | null;
};

export function useGmailIntegrationStatus() {
  return useGetQuery<GmailIntegrationStatus>({
    queryKey: gmailIntegrationKeys.status(),
    path: '/api/integrations/gmail/status',
    oneShot: true,
  });
}
