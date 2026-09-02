/**
 * src/api/useAuthUser.js - React Query hook for current auth user
 *
 * Remplace AuthContext pour les données utilisateur
 * Gère: login, logout, profil utilisateur, subscription
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch current authenticated user
 * Public endpoint (no auth needed for first call)
 */
async function fetchAuthUser() {
  if (!utils.token) return null

  const res = await fetch(`${utils.api}/auth/me`, utils.options)
  if (!res.ok) {
    if (res.status === 401) return null // Not authenticated
    throw new Error('Failed to fetch auth user')
  }
  return res.json()
}

/**
 * Hook: Get current authenticated user
 * ✅ Auto-refetches on window focus
 * ✅ Caches for 15 minutes
 * ✅ No duplicate requests (deduplication)
 *
 * Usage:
 *   const { data: user, isLoading, error } = useAuthUser()
 */
export function useAuthUser() {
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: fetchAuthUser,
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 30,    // 30 minutes garbage collection
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: !!utils.token,    // Only fetch if we have a token
  })
}

/**
 * Hook: Logout mutation
 * Clears auth token and invalidates user query
 *
 * Usage:
 *   const logout = useLogout()
 *   await logout()
 */
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${utils.api}/auth/logout`, {
        method: 'POST',
        ...utils.options,
      })
      if (!res.ok) throw new Error('Logout failed')
      return res.json()
    },
    onSuccess: () => {
      // Clear token and reset queries
      utils.token = null
      queryClient.clear()
    },
  })
}

/**
 * Hook: Get user profile (extended data)
 * Separates user auth from extended profile data
 */
export function useUserProfile(userId) {
  return useQuery({
    queryKey: ['users', userId, 'profile'],
    queryFn: async () => {
      const res = await fetch(`${utils.api}/profile/${userId}`, utils.options)
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json()
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Hook: Update user profile
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload) => {
      const res = await fetch(`${utils.api}/users/profile`, {
        method: 'PUT',
        ...utils.options,
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Update failed')
      return res.json()
    },
    onSuccess: (updatedUser) => {
      // Update cache
      queryClient.setQueryData(['auth', 'user'], updatedUser)
    },
  })
}
