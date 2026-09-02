/**
 * src/api/useClientsQuery.js - React Query hook for clients management
 * Fetches and manages clients for artists/advisors
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllClients, getClientsByArtist, updateClient, deleteClient, addClient } from './useClient'

export function useAllClients() {
  const query = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: async () => {
      const result = await getAllClients()
      if (result?.error) throw new Error(result.error)
      return Array.isArray(result) ? result : []
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
    gcTime: 1000 * 60 * 15,   // 15 min garbage collection
    retry: 1,
    refetchOnWindowFocus: true,
  })

  return {
    clients: query.data || [],
    loading: query.isLoading,
    error: query.error?.message,
  }
}

export function useClientsByArtist() {
  const query = useQuery({
    queryKey: ['clients', 'artist'],
    queryFn: async () => {
      const result = await getClientsByArtist()
      if (result?.error) throw new Error(result.error)
      return Array.isArray(result) ? result : []
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 1,
  })

  return {
    clients: query.data || [],
    loading: query.isLoading,
    error: query.error?.message,
  }
}

export function useAddClientMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => addClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateClient(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClientMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
