import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { getQueryDefaults } from './config'
import { fetchGet } from './fetch-get'

export type CursorPageArgs = {
  queryKeyBase: QueryKey
  path: string
  pageIndex: number
  cursor: string
  pageSize: number
  filters?: Record<string, string | undefined | null>
  extraParams?: Record<string, string | undefined | null>
}

export function buildCursorPageQueryKey({
  queryKeyBase,
  filters,
  pageIndex,
  cursor,
  pageSize,
}: CursorPageArgs): QueryKey {
  return [...queryKeyBase, filters ?? {}, pageIndex, cursor, pageSize]
}

export function buildCursorPageParams({
  cursor,
  pageSize,
  filters,
  extraParams,
}: Pick<CursorPageArgs, 'cursor' | 'pageSize' | 'filters' | 'extraParams'>) {
  return {
    limit: String(pageSize),
    ...(cursor ? { cursor } : {}),
    ...filters,
    ...extraParams,
  }
}

export async function fetchCursorPage<T>(args: CursorPageArgs): Promise<T> {
  return fetchGet<T>(args.path, {
    params: buildCursorPageParams(args),
  })
}

export async function prefetchCursorPage<T>(
  queryClient: QueryClient,
  args: CursorPageArgs
) {
  const queryKey = buildCursorPageQueryKey(args)

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => fetchCursorPage<T>(args),
    ...getQueryDefaults(),
  })
}
