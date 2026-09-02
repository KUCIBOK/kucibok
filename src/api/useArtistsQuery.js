/**
 * src/api/useArtistsQuery.js - React Query hook for artists
 * Remplace ArtistContext avec caching optimal
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

async function fetchArtists() {
  const res = await fetch(`${utils.api}/artists`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch artists')
  return res.json()
}

/**
 * Hook: Get all artists
 * ✅ Cached 30 minutes (artists change rarely)
 * ✅ Auto-refetch on window focus
 *
 * Usage:
 *   const { data: artists, isLoading } = useArtists()
 */
export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: fetchArtists,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60,    // 1 hour
    retry: 1,
    refetchOnWindowFocus: true,
  })
}
