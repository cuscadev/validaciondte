import type { QueryClient } from '@tanstack/react-query';

let queryClientRef: QueryClient | null = null;

export function registerQueryClient(client: QueryClient) {
  queryClientRef = client;
}

export function getRegisteredQueryClient() {
  return queryClientRef;
}

export function invalidateDashboardStats() {
  void queryClientRef?.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
}
