export {
  QUERY_CACHE_MS,
  QUERY_ONE_SHOT,
  createQueryClient,
  getQueryDefaults,
} from './config'

export {
  createGetQueryOptions,
  fetchGet,
  invalidateGetQueries,
  refreshGetQueries,
  type CreateGetQueryOptions,
} from './fetch-get'

export {
  buildCursorPageParams,
  buildCursorPageQueryKey,
  fetchCursorPage,
  prefetchCursorPage,
  type CursorPageArgs,
} from './prefetch-pagination'

export {
  useCursorPaginatedGetQuery,
  useGetQuery,
  type UseCursorPaginatedGetQueryArgs,
  type UseGetQueryArgs,
} from './hooks'
