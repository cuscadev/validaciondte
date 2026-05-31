'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import {
  createQueryClient,
  getQueryDefaults,
  QUERY_CACHE_MS,
} from '@/lib/tanstack-query'
import { registerQueryClient } from '@/lib/query-client-registry'
import ReactQueryDevtoolsPanel from '@/components/ReactQueryDevtoolsPanel'

export { QUERY_CACHE_MS, getQueryDefaults }

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient())

  useEffect(() => {
    registerQueryClient(queryClient)
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtoolsPanel />
    </QueryClientProvider>
  )
}
