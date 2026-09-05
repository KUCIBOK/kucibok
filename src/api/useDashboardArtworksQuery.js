/**
 * src/api/useDashboardArtworksQuery.js - React Query hooks for dashboard views
 * Replaces ArtworkContext for dashboard-specific artwork queries
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch artworks by status (admin/curator dashboard)
 * Uses /api/admin/artworks-list to bypass RLS (requires admin auth)
 */
async function fetchArtworksByStatus(status) {
  if (!utils.token) return []
  const res = await fetch(`${utils.api}/admin/artworks-list?status=${status}`, utils.options)
  if (!res.ok) throw new Error(`Failed to fetch ${status} artworks`)
  const data = await res.json()
  return data.artworks || []
}

/**
 * Fetch purchased artworks (buyer dashboard)
 */
async function fetchBoughtArtworks() {
  if (!utils.token) return []
  const res = await fetch(`${utils.api}/artworks/bought`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch bought artworks')
  return res.json()
}

/**
 * Hook: Get pending artworks (admin)
 * ✅ 5 min cache (status changes require refresh)
 * ✅ Auth required
 * ✅ Auto-refetch on window focus
 *
 * Usage:
 *   const { data: pending, isLoading } = usePendingArtworks()
 */
export function usePendingArtworks() {
  return useQuery({
    queryKey: ['artworks', 'pending'],
    queryFn: () => fetchArtworksByStatus('pending'),
    staleTime: 1000 * 60 * 5,   // 5 minutes
    gcTime: 1000 * 60 * 15,     // 15 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Get approved artworks (dashboard view)
 * ✅ 10 min cache
 * ✅ Auth required
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { data: approved, isLoading } = useApprovedDashboardArtworks()
 */
export function useApprovedDashboardArtworks() {
  return useQuery({
    queryKey: ['artworks', 'approved-dash'],
    queryFn: () => fetchArtworksByStatus('approved'),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Get rejected artworks (admin)
 * ✅ 10 min cache
 * ✅ Auth required
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { data: rejected, isLoading } = useRejectedArtworks()
 */
export function useRejectedArtworks() {
  return useQuery({
    queryKey: ['artworks', 'rejected'],
    queryFn: () => fetchArtworksByStatus('rejected'),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Get bought artworks (buyer dashboard)
 * ✅ 10 min cache
 * ✅ Auth required (buyer only)
 * ✅ Auto-refetch on focus
 *
 * Usage:
 *   const { data: bought = [], isLoading } = useBoughtArtworks()
 */
export function useBoughtArtworks() {
  return useQuery({
    queryKey: ['artworks', 'bought'],
    queryFn: fetchBoughtArtworks,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}

/**
 * Convenience: Get all dashboard stats in one call
 * Used by admin dashboard showing all statuses
 *
 * Usage:
 *   const { pending, approved, rejected } = useDashboardStats()
 */
export function useDashboardStats() {
  const pending = usePendingArtworks()
  const approved = useApprovedDashboardArtworks()
  const rejected = useRejectedArtworks()

  return {
    pending: pending.data || [],
    pendingLoading: pending.isLoading,
    approved: approved.data || [],
    approvedLoading: approved.isLoading,
    rejected: rejected.data || [],
    rejectedLoading: rejected.isLoading,
    isLoading: pending.isLoading || approved.isLoading || rejected.isLoading,
  }
}

/**
 * Fetch priority access artworks (for collector discovery)
 */
async function fetchPriorityAccessArtworks() {
  if (!utils.token) return { artworks: [], count: 0 }
  const res = await fetch(`${utils.api}/artworks/priority-access`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch priority access artworks')
  return res.json()
}

/**
 * Hook: Get priority access artworks (collector discovery)
 * ✅ 5 min cache (priority items change frequently)
 * ✅ Auth required (collector only)
 *
 * Usage:
 *   const { data: priority } = usePriorityAccessArtworks()
 */
export function usePriorityAccessArtworks() {
  return useQuery({
    queryKey: ['artworks', 'priority-access'],
    queryFn: fetchPriorityAccessArtworks,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: !!utils.token,
  })
}
