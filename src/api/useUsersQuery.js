/**
 * src/api/useUsersQuery.js - React Query hook for users management
 * Fetches and manages admin users list
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllUsers, updateUser, deleteUser } from './useUsers'

export function useAllUsers() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['users', 'all'],
    queryFn: async () => {
      const result = await getAllUsers()
      if (result?.error) throw new Error(result.error)
      return Array.isArray(result) ? result : []
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
    gcTime: 1000 * 60 * 15,   // 15 min garbage collection
    retry: 1,
    refetchOnWindowFocus: true,
  })

  return {
    users: query.data || [],
    loading: query.isLoading,
    error: query.error?.message,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['users', 'all'] }),
  }
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    },
  })
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    },
  })
}
