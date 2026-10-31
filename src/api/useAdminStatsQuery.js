/**
 * src/api/useAdminStatsQuery.js - React Query hook for admin statistics
 * Lit /api/admin/stats : aucune valeur de remplacement, l'erreur est exposée.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'

async function fetchAdminStats() {
  const res = await fetch(`${utils.api}/admin/stats`, utils.options)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Statistiques indisponibles (HTTP ${res.status})`)
  }
  return res.json()
}

export function useAdminStats() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
    enabled: !!utils.token,
    staleTime: 1000 * 60 * 5, // 5 min cache
    gcTime: 1000 * 60 * 15, // 15 min garbage collection
    retry: 1,
    refetchOnWindowFocus: true,
  })

  return {
    stats: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
  }
}
