'use client'

import { useEffect, useMemo } from 'react'
import {
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query'

import {
  createGetQueryOptions,
  type CreateGetQueryOptions,
} from './fetch-get'
import {
  buildCursorPageQueryKey,
  fetchCursorPage,
  prefetchCursorPage,
  type CursorPageArgs,
} from './prefetch-pagination'

export type UseGetQueryArgs<
  TQueryFnData,
  TData = TQueryFnData,
> = CreateGetQueryOptions<TQueryFnData, TData>

export function useGetQuery<TQueryFnData, TData = TQueryFnData>(
  args: UseGetQueryArgs<TQueryFnData, TData>
): UseQueryResult<TData> {
  return useQuery(createGetQueryOptions(args))
}

export type UseCursorPaginatedGetQueryArgs<T> = Omit<
  CursorPageArgs,
  'pageIndex' | 'cursor'
> & {
  pageIndex: number
  cursor: string
  enabled?: boolean
  getNextCursor?: (data: T | undefined) => string | null
  hasMore?: (data: T | undefined) => boolean
}

export function useCursorPaginatedGetQuery<T>(
  args: UseCursorPaginatedGetQueryArgs<T>
): UseQueryResult<T> {
  const queryClient = useQueryClient()
  const {
    queryKeyBase,
    path,
    pageIndex,
    cursor,
    pageSize,
    filters,
    extraParams,
    enabled = true,
    getNextCursor,
    hasMore,
  } = args

  const pageArgs: CursorPageArgs = useMemo(
    () => ({
      queryKeyBase,
      path,
      pageIndex,
      cursor,
      pageSize,
      filters,
      extraParams,
    }),
    [queryKeyBase, path, pageIndex, cursor, pageSize, filters, extraParams]
  )

  const query = useQuery<T>({
    ...createGetQueryOptions<T>({
      queryKey: buildCursorPageQueryKey(pageArgs),
      path,
      enabled,
      overrides: {
        queryFn: () => fetchCursorPage<T>(pageArgs),
        placeholderData: (previous) => previous,
      },
    }),
  })

  useEffect(() => {
    if (!enabled || !query.data) return

    const nextCursor = getNextCursor?.(query.data) ?? null
    const canPrefetch = hasMore?.(query.data) ?? Boolean(nextCursor)

    if (!canPrefetch || !nextCursor) return

    void prefetchCursorPage<T>(queryClient, {
      ...pageArgs,
      pageIndex: pageIndex + 1,
      cursor: nextCursor,
    })
  }, [enabled, getNextCursor, hasMore, pageArgs, pageIndex, query.data, queryClient])

  return query
}

export type { QueryKey }
