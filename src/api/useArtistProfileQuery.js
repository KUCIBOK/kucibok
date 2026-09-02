/**
 * src/api/useArtistProfileQuery.js - React Query hook for artist profile
 * Returns artist profile for current authenticated artist user
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthUser } from './useAuthUser'

/**
 * Hook: Get current authenticated artist's profile
 * Returns profile if current user is an artist, null otherwise
 *
 * Usage:
 *   const { data: artistProfile } = useArtistProfile()
 */
export function useArtistProfile() {
  const queryClient = useQueryClient()

  // Get current user (already cached by useAuthUser)
  const { data: user } = useAuthUser()

  // Extract artistProfile from user metadata if user is an artist
  const artistProfile = user?.role === 'artist' ? user : null

  return {
    data: artistProfile,
    isLoading: false, // Piggyback on useAuthUser loading
  }
}
