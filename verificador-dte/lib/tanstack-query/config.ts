import { QueryClient } from '@tanstack/react-query'

export const QUERY_CACHE_MS = 15_000

export const getQueryDefaults = () => ({
  staleTime: QUERY_CACHE_MS,
  gcTime: QUERY_CACHE_MS * 4,
  refetchInterval: QUERY_CACHE_MS,
  refetchOnWindowFocus: false,
  retry: 1,
})

export const QUERY_ONE_SHOT = {
  refetchInterval: false as const,
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: getQueryDefaults(),
    },
  })
}
