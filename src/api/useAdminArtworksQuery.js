/**
 * src/api/useAdminArtworksQuery.js - React Query hooks for admin artwork views
 * Replaces admin-specific parts of ArtworkContext
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch approved artworks (admin view)
 */
async function fetchApprovedArtworks() {
  const res = await fetch(`${utils.api}/artworks?status=approved`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch approved artworks')
  return res.json()
}

/**
 * Fetch current user's artworks (artist view)
 */
async function fetchMyArtworks() {
  if (!utils.token) return []
  const res = await fetch(`${utils.api}/artworks/my`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch my artworks')
  return res.json()
}

/**
 * Hook: Get approved artworks (admin)
 * ✅ 10 min cache
 * ✅ Auto-refetch on window focus
 *
 * Usage:
 *   const { data: approved, isLoading } = useApprovedArtworks()
 */
export function useApprovedArtworks() {
  return useQuery({
    queryKey: ['artworks', 'approved'],
    queryFn: fetchApprovedArtworks,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30,    // 30 minutes
    retry: 1,
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook: Get current user's artworks (artist)
 * ✅ 5 min cache (user can create/update)
 * ✅ Auto-refetch on window focus
 * ✅ Only fetch if authenticated
 *
 * Usage:
 *   const { data: myArtworks, isLoading, loading } = useMyArtworks()
 */
export function useMyArtworks() {
  const query = useQuery({
    queryKey: ['artworks', 'my'],
    queryFn: fetchMyArtworks,
    staleTime: 1000 * 60 * 5,   // 5 minutes (user may add/edit)
    gcTime: 1000 * 60 * 15,     // 15 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,     // Only fetch if authenticated
  })

  // Return with both `data` and `isLoading` (for compatibility with old code)
  return {
    ...query,
    myArtworks: query.data || [],
    loading: query.isLoading,
  }
}
