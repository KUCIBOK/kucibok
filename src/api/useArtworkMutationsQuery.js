/**
 * src/api/useArtworkMutationsQuery.js - React Query mutations for artwork actions
 * Replaces ArtworkContext mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'

// API call functions
async function approveArtworkAPI(id, status) {
  const res = await fetch(`${utils.api}/artworks/${id}/approve`, {
    method: 'PUT',
    ...utils.options,
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('Failed to approve artwork')
  return res.json()
}

async function submitArtworkAPI(artwork) {
  const res = await fetch(`${utils.api}/artworks`, {
    method: 'POST',
    ...utils.options,
    body: JSON.stringify(artwork),
  })
  if (!res.ok) throw new Error('Failed to submit artwork')
  return res.json()
}

async function updateArtworkAPI(id, payload) {
  const res = await fetch(`${utils.api}/artworks/${id}`, {
    method: 'PUT',
    ...utils.options,
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to update artwork')
  return res.json()
}

async function modifyEtherscanAPI(id, etherscan) {
  const res = await fetch(`${utils.api}/artworks/${id}/etherscan`, {
    method: 'PUT',
    ...utils.options,
    body: JSON.stringify({ etherscan }),
  })
  if (!res.ok) throw new Error('Failed to update etherscan')
  return res.json()
}

/**
 * Hook: Get all artwork mutations
 * ✅ useMutation for each action
 * ✅ Auto-invalidates cache on success
 * ✅ Returns error state for UI feedback
 *
 * Usage:
 *   const { approveArtwork, submitArtwork, updateArtwork, modifyEtherscan } = useArtworkMutations()
 *
 *   // Then call them:
 *   approveArtwork.mutate({ id, status })
 *   // Or:
 *   const data = await approveArtwork.mutateAsync({ id, status })
 */
export function useArtworkMutations() {
  const queryClient = useQueryClient()

  const approveArtwork = useMutation({
    mutationFn: ({ id, status }) => approveArtworkAPI(id, status),
    onSuccess: () => {
      // Invalidate artwork queries so they refetch
      queryClient.invalidateQueries({ queryKey: ['artworks'] })
    },
  })

  const submitArtwork = useMutation({
    mutationFn: (artwork) => submitArtworkAPI(artwork),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artworks'] })
    },
  })

  const updateArtwork = useMutation({
    mutationFn: ({ id, payload }) => updateArtworkAPI(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artworks'] })
    },
  })

  const modifyEtherscan = useMutation({
    mutationFn: ({ id, etherscan }) => modifyEtherscanAPI(id, etherscan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artworks'] })
    },
  })

  return {
    approveArtwork,
    submitArtwork,
    updateArtwork,
    modifyEtherscan,
  }
}
