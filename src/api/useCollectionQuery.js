/**
 * src/api/useCollectionQuery.js - React Query hooks for collector's personal collection
 * Supports filtering, sorting, and pagination
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch user's complete collection (bought + digitized)
 * Supports filters: artist, medium, source, acquisition year
 * Supports sort: date, value, artist_name
 */
async function fetchCollection(filters = {}, sort = 'date_desc', page = 0) {
  if (!utils.token) return { artworks: [], count: 0, total_value: 0 }

  const params = new URLSearchParams({
    sort,
    page,
    ...filters,
  })

  const res = await fetch(`${utils.api}/artworks/collection?${params}`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch collection')
  return res.json()
}

/**
 * Hook: Get user's complete collection
 * ✅ 10 min cache
 * ✅ Auth required
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { data, isLoading, error } = useCollection({ artist: 'abc', medium: 'painting' }, 'value_desc')
 */
export function useCollection(filters = {}, sort = 'date_desc', page = 0) {
  return useQuery({
    queryKey: ['artworks', 'collection', filters, sort, page],
    queryFn: () => fetchCollection(filters, sort, page),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Get collection summary stats for dashboard
 * ✅ 10 min cache
 * ✅ Auth required
 *
 * Usage:
 *   const { total_artworks, total_value } = useCollectionSummary()
 */
export function useCollectionSummary() {
  return useQuery({
    queryKey: ['artworks', 'collection-summary'],
    queryFn: async () => {
      const res = await fetch(`${utils.api}/artworks/collection-summary`, utils.options)
      if (!res.ok) throw new Error('Failed to fetch collection summary')
      return res.json()
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Get recent acquisitions (for dashboard preview)
 * ✅ 5 min cache
 * ✅ Auth required
 *
 * Usage:
 *   const { data: recent } = useRecentAcquisitions(3)
 */
export function useRecentAcquisitions(limit = 3) {
  return useQuery({
    queryKey: ['artworks', 'recent-acquisitions', limit],
    queryFn: async () => {
      const res = await fetch(
        `${utils.api}/artworks/collection/recent?limit=${limit}`,
        utils.options
      )
      if (!res.ok) throw new Error('Failed to fetch recent acquisitions')
      return res.json()
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}
