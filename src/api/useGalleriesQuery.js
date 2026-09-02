/**
 * src/api/useGalleriesQuery.js - React Query hook for galleries
 * Replaces GalleryContext
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch all galleries (admin view)
 */
async function fetchGalleries() {
  if (!utils.token) return { galleries: [], total: 0, filtered: [] }
  const res = await fetch(`${utils.api}/galleries`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch galleries')
  return res.json()
}

/**
 * Hook: Get all galleries with pagination + search
 * ✅ 10 min cache
 * ✅ Auth required
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { galleries, total, filtered, refresh } = useGalleries()
 */
export function useGalleries() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['galleries'],
    queryFn: fetchGalleries,
    staleTime: 1000 * 60 * 10,  // 10 minutes
    gcTime: 1000 * 60 * 30,     // 30 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })

  const data = query.data || { galleries: [], total: 0, filtered: [] }

  return {
    galleries: data.galleries || [],
    total: data.total || 0,
    filtered: data.filtered || [],
    isLoading: query.isLoading,
    error: query.error,
    // Refresh function to manually refetch
    refresh: () => queryClient.invalidateQueries({ queryKey: ['galleries'] }),
  }
}
