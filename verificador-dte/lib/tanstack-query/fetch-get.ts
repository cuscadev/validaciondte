import type { QueryClient, QueryKey, UseQueryOptions } from '@tanstack/react-query'

import { auth } from '@/lib/firebase'

import { getQueryDefaults, QUERY_ONE_SHOT } from './config'

type FetchGetOptions = {
  token?: string | null
  params?: Record<string, string | undefined | null>
  cache?: RequestCache
  requireAuth?: boolean
}

type ErrorPayload = {
  error?: string
  message?: string
}

export async function fetchGet<T>(path: string, options: FetchGetOptions = {}): Promise<T> {
  const {
    token: providedToken,
    params,
    cache = 'no-store',
    requireAuth = true,
  } = options

  const token =
    providedToken === undefined
      ? await auth.currentUser?.getIdToken()
      : providedToken

  if (requireAuth && !token) {
    throw new Error('No autorizado')
  }

  const searchParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && String(value).trim() !== '') {
        searchParams.set(key, String(value))
      }
    })
  }

  const queryString = searchParams.toString()
  const url = queryString ? `${path}?${queryString}` : path

  const headers: HeadersInit = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, { headers, cache })
  const data = (await res.json().catch(() => ({}))) as T & ErrorPayload

  if (!res.ok) {
    throw new Error(data.error || data.message || `Error al cargar ${path}`)
  }

  return data as T
}

export type CreateGetQueryOptions<
  TQueryFnData,
  TData = TQueryFnData,
> = {
  queryKey: QueryKey
  path: string
  params?: Record<string, string | undefined | null>
  enabled?: boolean
  oneShot?: boolean
  requireAuth?: boolean
  overrides?: Partial<UseQueryOptions<TQueryFnData, Error, TData>>
}

export function createGetQueryOptions<
  TQueryFnData,
  TData = TQueryFnData,
>({
  queryKey,
  path,
  params,
  enabled = true,
  oneShot = false,
  requireAuth = true,
  overrides,
}: CreateGetQueryOptions<TQueryFnData, TData>): UseQueryOptions<
  TQueryFnData,
  Error,
  TData
> {
  return {
    queryKey,
    enabled,
    queryFn: () =>
      fetchGet<TQueryFnData>(path, {
        params,
        requireAuth,
      }),
    ...getQueryDefaults(),
    ...(oneShot ? QUERY_ONE_SHOT : {}),
    ...overrides,
  }
}

export async function invalidateGetQueries(
  queryClient: QueryClient,
  queryKey: QueryKey
) {
  await queryClient.invalidateQueries({ queryKey })
}

export async function refreshGetQueries(
  queryClient: QueryClient,
  queryKey: QueryKey
) {
  await invalidateGetQueries(queryClient, queryKey)
}
