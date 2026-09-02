/**
 * src/api/useArtistContextQuery.js - React Query hook for artist data
 * Replaces ArtistContext
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'

async function fetchArtists() {
  const res = await fetch(`${utils.api}/artists`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch artists')
  return res.json()
}

export function useArtist() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['artists'],
    queryFn: fetchArtists,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnWindowFocus: true,
  })

  return {
    artists: query.data || [],
    loading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['artists'] }),
  }
}
