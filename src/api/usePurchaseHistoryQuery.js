/**
 * src/api/usePurchaseHistoryQuery.js - React Query hooks for purchase history
 * Distinct from collection: transactions only, not owned artworks
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch user's purchase history (transactions on the platform)
 * Filters: period (date range), status (paid/pending/refunded)
 */
async function fetchPurchaseHistory(filters = {}) {
  if (!utils.token) return { transactions: [], count: 0 }

  const params = new URLSearchParams(filters)
  const res = await fetch(`${utils.api}/artworks/purchase-history?${params}`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch purchase history')
  return res.json()
}

/**
 * Hook: Get purchase history
 * ✅ 10 min cache
 * ✅ Auth required
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { data, isLoading } = usePurchaseHistory({ status: 'paid', from_date: '2026-01-01' })
 */
export function usePurchaseHistory(filters = {}) {
  return useQuery({
    queryKey: ['transactions', 'purchase-history', filters],
    queryFn: () => fetchPurchaseHistory(filters),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Get purchase statistics for dashboard
 * ✅ 10 min cache
 *
 * Usage:
 *   const { total_purchased, total_amount } = usePurchaseStats()
 */
export function usePurchaseStats() {
  return useQuery({
    queryKey: ['transactions', 'purchase-stats'],
    queryFn: async () => {
      const res = await fetch(`${utils.api}/artworks/purchase-stats`, utils.options)
      if (!res.ok) throw new Error('Failed to fetch purchase stats')
      return res.json()
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}
