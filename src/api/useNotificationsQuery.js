/**
 * src/api/useNotificationsQuery.js - React Query hooks for notification preferences
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'
import { toast } from '../components/ui'

/**
 * Fetch user's notification preferences
 */
async function fetchNotificationPreferences() {
  if (!utils.token) return { preferences: {} }

  const res = await fetch(`${utils.api}/notifications/preferences`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch notification preferences')
  return res.json()
}

/**
 * Update notification preferences
 */
async function updateNotificationPreferences(prefs) {
  if (!utils.token) throw new Error('Not authenticated')

  const res = await fetch(`${utils.api}/notifications/preferences`, {
    ...utils.options,
    method: 'POST',
    body: JSON.stringify(prefs),
  })
  if (!res.ok) throw new Error('Failed to update preferences')
  return res.json()
}

/**
 * Hook: Get notification preferences
 * ✅ 10 min cache
 * ✅ Auth required
 *
 * Usage:
 *   const { data: prefs } = useNotificationPreferences()
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: fetchNotificationPreferences,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    enabled: !!utils.token,
  })
}

/**
 * Hook: Update notification preferences (mutation)
 *
 * Usage:
 *   const { mutate: updatePrefs } = useUpdateNotificationPreferencesMutation()
 *   updatePrefs({ email_alerts: true, frequency: 'weekly' })
 */
export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] })
      toast.success('Préférences mises à jour')
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour')
    },
  })
}
