/**
 * src/api/useFollowedArtistsQuery.js - React Query hooks for followed artists
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'
import { toast } from '../components/ui'

/**
 * Fetch user's followed artists with new work badges
 */
async function fetchFollowedArtists() {
  if (!utils.token) return { artists: [], count: 0 }

  const res = await fetch(`${utils.api}/artists/followed`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch followed artists')
  return res.json()
}

/**
 * Follow an artist
 */
async function followArtist(artistId) {
  if (!utils.token) throw new Error('Not authenticated')

  const res = await fetch(`${utils.api}/artist/follow/${artistId}`, {
    ...utils.options,
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error('Failed to follow artist')
  return res.json()
}

/**
 * Unfollow an artist
 */
async function unfollowArtist(artistId) {
  if (!utils.token) throw new Error('Not authenticated')

  const res = await fetch(`${utils.api}/artist/unfollow/${artistId}`, {
    ...utils.options,
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error('Failed to unfollow artist')
  return res.json()
}

/**
 * Hook: Get followed artists
 * ✅ 10 min cache
 * ✅ Auth required
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { data: artists, isLoading } = useFollowedArtists()
 */
export function useFollowedArtists() {
  return useQuery({
    queryKey: ['artists', 'followed'],
    queryFn: fetchFollowedArtists,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Follow an artist (mutation)
 *
 * Usage:
 *   const { mutate: follow } = useFollowArtistMutation()
 *   follow(artistId)
 */
export function useFollowArtistMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: followArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists', 'followed'] })
      toast.success('Artiste ajouté à vos suivis')
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du suivi')
    },
  })
}

/**
 * Hook: Unfollow an artist (mutation)
 *
 * Usage:
 *   const { mutate: unfollow } = useUnfollowArtistMutation()
 *   unfollow(artistId)
 */
export function useUnfollowArtistMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unfollowArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists', 'followed'] })
      toast.success('Artiste retiré de vos suivis')
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du retrait')
    },
  })
}
