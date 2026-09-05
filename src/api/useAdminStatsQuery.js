/**
 * src/api/useAdminStatsQuery.js - React Query hook for admin statistics
 * Fetches real-time user counts and KPIs from backend
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'

async function fetchAdminStats() {
  if (!utils.token) return null
  const res = await fetch(`${utils.api}/admin/stats`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch admin stats')
  return res.json()
}

export function useAdminStats() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
    staleTime: 1000 * 60 * 5, // 5 min cache
    gcTime: 1000 * 60 * 15,   // 15 min garbage collection
    retry: 1,
    refetchOnWindowFocus: true,
  })

  return {
    stats: query.data || {
      totalUsers: 0,
      artists: 0,
      collectors: 0,
      professionals: 0,
      totalArtworks: 0,
      approvedArtworks: 0,
      pendingArtworks: 0,
      totalTransactions: 0,
      totalRevenue: 0,
      activeSubscriptions: 0,
    },
    loading: query.isLoading,
    error: query.error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
  }
}
