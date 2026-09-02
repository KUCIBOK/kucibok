/**
 * src/api/useSubscriptionQuery.js - React Query hook for subscriptions
 *
 * Remplace SubscriptionContext avec données fetching optimal
 * Gère: current subscription, plan, status
 * ✅ Auto-caching
 * ✅ Auto-refetching on window focus
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

/**
 * Fetch current user's subscription
 */
async function fetchSubscription() {
  if (!utils.token) return null

  const res = await fetch(`${utils.api}/subscriptions/current`, utils.options)
  if (!res.ok) {
    if (res.status === 404) return null // No active subscription
    throw new Error('Failed to fetch subscription')
  }
  return res.json()
}

/**
 * Hook: Get current user's subscription
 * ✅ Auto-refetches on window focus
 * ✅ Caches for 10 minutes
 * ✅ Returns null if no active subscription
 *
 * Usage:
 *   const { data: subscription, isLoading } = useSubscription()
 *   const isSubscriptionActive = subscription?.status === 'active'
 */
export function useSubscription() {
  return useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: fetchSubscription,
    staleTime: 1000 * 60 * 10, // 10 minutes (subscription changes are rare)
    gcTime: 1000 * 60 * 30,    // 30 minutes garbage collection
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: !!utils.token,    // Only fetch if we have a token
  })
}
