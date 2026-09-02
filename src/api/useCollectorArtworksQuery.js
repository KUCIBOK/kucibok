/**
 * src/api/useCollectorArtworksQuery.js - React Query hooks for collector/buyer views
 * Replaces ArtworkContext for collector-specific queries
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch user's favorite artworks
 */
async function fetchFavoriteArtworks() {
  if (!utils.token) return []
  const res = await fetch(`${utils.api}/artworks/favorites`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch favorites')
  return res.json()
}

/**
 * Hook: Get user's favorite artworks
 * ✅ 10 min cache
 * ✅ Auth required
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { data: favorites = [], isLoading } = useFavoriteArtworks()
 */
export function useFavoriteArtworks() {
  return useQuery({
    queryKey: ['artworks', 'favorites'],
    queryFn: fetchFavoriteArtworks,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Convenience: Get both bought and favorites in one call
 * For collector dashboard
 *
 * Usage:
 *   const { buyed, favorites, loading } = useCollectorView()
 */
export function useCollectorView() {
  const buyed = useQuery({
    queryKey: ['artworks', 'bought'],
    queryFn: async () => {
      const res = await fetch(`${utils.api}/artworks/bought`, utils.options)
      if (!res.ok) throw new Error('Failed to fetch bought')
      return res.json()
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })

  const favorites = useFavoriteArtworks()

  return {
    buyed: buyed.data || [],
    favorites: favorites.data || [],
    loading: buyed.isLoading || favorites.isLoading,
  }
}
