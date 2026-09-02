/**
 * src/api/useArtworksQuery.js - React Query hook for artworks
 *
 * Remplace ArtworkContext avec données fetching optimal
 * Gère: list, filters, pagination, search
 * ✅ Automatique deduplication (même query = 1 request)
 * ✅ Caching automatique
 * ✅ Refetching sur filtre change
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch artworks with filters
 * Params: limit, offset, status, category, for_sale, artist_id, search
 */
async function fetchArtworks(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value)
    }
  })

  const url = `${utils.api}/artworks${params.toString() ? `?${params}` : ''}`
  const res = await fetch(url, utils.options)

  if (!res.ok) throw new Error('Failed to fetch artworks')
  return res.json()
}

/**
 * Hook: Get artworks with filtering & pagination
 *
 * ✅ Auto-deduplication: Same query only fetches once
 * ✅ Auto-refetch: When filters change, refetch automatically
 * ✅ Auto-cache: Data cached for 2 minutes
 *
 * Usage:
 *   const { data, isLoading, error } = useArtworks({
 *     for_sale: true,
 *     category: 'painting',
 *     limit: 50
 *   })
 *
 * Performance:
 *   - First call: fetch (200ms)
 *   - Second call same filters: cache (instant)
 *   - Change filter: fetch new + cache (200ms)
 */
export function useArtworks(filters = {}) {
  return useQuery({
    queryKey: ['artworks', filters], // ✅ Key includes filters = automatic refetch
    queryFn: () => fetchArtworks(filters),
    staleTime: 1000 * 60 * 2,  // 2 minutes (data changes frequently)
    gcTime: 1000 * 60 * 5,     // 5 minutes garbage collection
    retry: 1,
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook: Get single artwork detail
 */
export function useArtworkDetail(artworkId) {
  return useQuery({
    queryKey: ['artworks', artworkId, 'detail'],
    queryFn: async () => {
      const res = await fetch(`${utils.api}/artworks/${artworkId}`, utils.options)
      if (!res.ok) throw new Error('Failed to fetch artwork')
      return res.json()
    },
    enabled: !!artworkId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Hook: Verify artwork by KCB ID (public - no auth)
 */
export function useVerifyArtwork(kcbId) {
  return useQuery({
    queryKey: ['artworks', 'verify', kcbId],
    queryFn: async () => {
      const res = await fetch(`/api/artworks/verify/${kcbId}`)
      if (!res.ok) throw new Error('Artwork not found')
      return res.json()
    },
    enabled: !!kcbId,
    staleTime: 1000 * 60 * 60, // 1 hour (verification data is stable)
  })
}

/**
 * Hook: Create artwork
 */
export function useCreateArtwork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (artworkData) => {
      const res = await fetch(`${utils.api}/artworks`, {
        method: 'POST',
        ...utils.options,
        body: JSON.stringify(artworkData),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create artwork')
      }
      return res.json()
    },
    onSuccess: (newArtwork) => {
      // Invalidate artworks list to refetch
      queryClient.invalidateQueries({ queryKey: ['artworks'] })
    },
  })
}

/**
 * Hook: Update artwork
 */
export function useUpdateArtwork(artworkId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates) => {
      const res = await fetch(`${utils.api}/artworks/${artworkId}`, {
        method: 'PUT',
        ...utils.options,
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update artwork')
      return res.json()
    },
    onSuccess: (updatedArtwork) => {
      // Update cache for this specific artwork
      queryClient.setQueryData(['artworks', artworkId, 'detail'], updatedArtwork)
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: ['artworks'] })
    },
  })
}

/**
 * Hook: Delete artwork
 */
export function useDeleteArtwork(artworkId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${utils.api}/artworks/${artworkId}`, {
        method: 'DELETE',
        ...utils.options,
      })
      if (!res.ok) throw new Error('Failed to delete artwork')
      return res.json()
    },
    onSuccess: () => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['artworks', artworkId] })
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: ['artworks'] })
    },
  })
}
