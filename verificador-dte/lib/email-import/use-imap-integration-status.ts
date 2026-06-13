'use client';

import { useAuth } from '@/components/AuthProvider';
import { useGetQuery } from '@/lib/tanstack-query';
import { imapIntegrationKeys } from '@/lib/email-import/query-keys';

export type ImapIntegrationStatus = {
  connected: boolean;
  email: string | null;
  host: string | null;
  port: number | null;
  provider: string | null;
  authType: 'password' | 'oauth' | null;
  connectedAt: string | null;
  consentAcceptedAt: string | null;
  lastSync: {
    id: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    importedCount: number;
  } | null;
};

export function useImapIntegrationStatus() {
  const { authChecked, isAuthenticated } = useAuth();

  return useGetQuery<ImapIntegrationStatus>({
    queryKey: imapIntegrationKeys.status(),
    path: '/api/integrations/imap/status',
    oneShot: true,
    enabled: authChecked && isAuthenticated,
  });
}
