/**
 * src/api/useArtworkMutationsQuery.js - Actions d'écriture sur les œuvres
 *
 * Les composants appellent ces actions comme des fonctions async et lisent le résultat :
 *   const updated = await approveArtwork(id, 'approved')   // { id, ... } ou { error }
 * Chaque action invalide le cache React Query ['artworks'] quand elle réussit.
 */

import { useQueryClient } from '@tanstack/react-query'
import { utils } from './useAPI'
import { submitArtwork as submitArtworkRequest, updateArtwork as updateArtworkRequest } from './useArtworks'

/** PUT /api/artworks/:id/approve — modération admin (approved | rejected | pending). */
async function moderateArtworkRequest(id, status) {
  try {
    const res = await fetch(`${utils.api}/artworks/${id}/approve`, {
      ...utils.options,
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) return { error: body?.error || `Erreur serveur (HTTP ${res.status})` }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/** PUT /api/artworks/:id/etherscan — adresse blockchain (admin). */
async function modifyEtherscanRequest(id, etherscan) {
  try {
    const res = await fetch(`${utils.api}/artworks/${id}/etherscan`, {
      ...utils.options,
      method: 'PUT',
      body: JSON.stringify({ etherscan }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) return { error: body?.error || `Erreur serveur (HTTP ${res.status})` }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Hook : actions d'écriture sur les œuvres.
 *
 * Usage :
 *   const { approveArtwork, submitArtwork, updateArtwork, modifyEtherscan } = useArtworkMutations()
 */
export function useArtworkMutations() {
  const queryClient = useQueryClient()

  // Exécute l'action et rafraîchit les listes uniquement si elle a réussi
  const withRefresh =
    (action) =>
    async (...args) => {
      const result = await action(...args)
      if (!result?.error) queryClient.invalidateQueries({ queryKey: ['artworks'] })
      return result
    }

  return {
    approveArtwork: withRefresh(moderateArtworkRequest),
    submitArtwork: withRefresh(submitArtworkRequest),
    updateArtwork: withRefresh(updateArtworkRequest),
    modifyEtherscan: withRefresh(modifyEtherscanRequest),
  }
}
