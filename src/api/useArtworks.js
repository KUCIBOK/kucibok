/**
 * useArtworks.js — Fonctions d'appel API pour les œuvres d'art.
 *
 * Toutes les routes filtrent via query params (nouvelle API Supabase).
 * Réponses normalisées : { data, pagination } ou { error }.
 *
 * @module useArtworks
 */

import { fetchWithTimeout, utils } from './useAPI'

/** Mélange un tableau en place avec l'algorithme Fisher-Yates (non biaisé). */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const { api } = utils

// ─────────────────────────────────────────────────────────────────────────────
// HELPER INTERNE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appel GET /artworks avec query params.
 *
 * @param {Record<string, string|number|boolean>} params
 * @returns {Promise<object>} { data: [], pagination: {} } ou { error }
 */
export async function fetchArtworks(params = {}) {
  try {
    const qs = new URLSearchParams(params).toString()
    const response = await fetchWithTimeout(`${api}/artworks${qs ? `?${qs}` : ''}`, {
      ...utils.options,
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    // Extrait correctement le tableau d'artworks de la réponse
    return Array.isArray(body) ? body : (body?.artworks ?? body?.data ?? [])
  } catch (err) {
    return { error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VÉRIFICATION PUBLIQUE (Standard Kucibok — QR code)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/artworks/verify/:kuciobkId — Vérification publique, sans auth.
 *
 * @param {string} kuciobkId
 * @returns {Promise<object | { error: string }>}
 */
export async function verifyArtwork(kuciobkId) {
  try {
    const response = await fetch(`${api}/artworks/verify/${kuciobkId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/artworks — Liste paginée des œuvres avec filtres optionnels.
 *
 * @param {Record<string, string|number|boolean>} [params]
 * @returns {Promise<{ data: object[], pagination: object } | { error: string }>}
 */
export async function getAllArtworks(params = {}) {
  return fetchArtworks(params)
}

/**
 * GET /api/artworks/:id — Détail d'une œuvre.
 *
 * @param {string} id
 * @returns {Promise<object | { error: string }>}
 */
export async function getArtworkById(id) {
  try {
    const response = await fetch(`${api}/artworks/${id}`, { ...utils.options })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * GET /api/artworks?for_sale=true — Œuvres en vente.
 *
 * @returns {Promise<object>}
 */
export async function getForSaleArtworks() {
  return fetchArtworks({ for_sale: true, status: 'approved', limit: 1000 })
}

/**
 * GET /api/artworks?artist_id=:id&for_sale=true — Œuvres en vente d'un artiste.
 *
 * @param {string} id - artist_id (UUID)
 * @returns {Promise<object>}
 */
export async function getArtistForSaleArtworks(id) {
  return fetchArtworks({ artist_id: id, for_sale: true })
}

/**
 * GET /api/artworks?user_id=:id&for_sale=true — Œuvres en vente d'un propriétaire.
 *
 * @param {string} id - user_id (UUID)
 * @returns {Promise<object>}
 */
export async function getOwnerForSaleArtworks(id) {
  return fetchArtworks({ user_id: id, for_sale: true })
}

/**
 * GET /api/artworks?artist_id=:id — Toutes les œuvres d'un artiste.
 *
 * @param {string} id - artist_id (UUID)
 * @returns {Promise<object>}
 */
export async function getMyArtworks(id) {
  return fetchArtworks({ artist_id: id })
}

/**
 * GET /api/artworks?user_id=:id — Œuvres d'un propriétaire (acheteur).
 *
 * @param {string} id - user_id (UUID)
 * @returns {Promise<object>}
 */
export async function getOwnerArtworks(id) {
  return fetchArtworks({ user_id: id })
}

/**
 * GET /api/artworks?status=pending — Œuvres en attente d'approbation (admin).
 *
 * @returns {Promise<object>}
 */
export async function getPendingArtworks() {
  return fetchArtworks({ status: 'pending' })
}

/**
 * GET /api/artworks?status=approved — Œuvres approuvées (admin).
 *
 * @param {object} [params] - Additional query parameters (limit, category, etc.)
 * @returns {Promise<object>}
 */
export async function getApprovedArtworks(params = {}) {
  return fetchArtworks({ status: 'approved', ...params })
}

/**
 * GET /api/artworks?status=rejected — Œuvres rejetées (admin).
 *
 * @returns {Promise<object>}
 */
export async function getRejectedArtworks() {
  return fetchArtworks({ status: 'rejected' })
}

/**
 * GET /api/artworks — Sélection aléatoire d'œuvres approuvées en vente.
 * Le mélange est fait côté client pour éviter un endpoint dédié.
 *
 * @returns {Promise<object[] | { error: string }>}
 */
export async function getRandomArtworks() {
  const result = await fetchArtworks({ for_sale: true, limit: 20 })
  if (result.error) return result
  const items = Array.isArray(result) ? [...result] : []
  return shuffleArray(items).slice(0, 8)
}

/**
 * GET /api/artworks?category=:category — Œuvres aléatoires d'une catégorie.
 *
 * @param {string} category
 * @returns {Promise<object[] | { error: string }>}
 */
export async function getRandomArtworksByCategories(category) {
  const result = await fetchArtworks({ category, for_sale: true, limit: 20 })
  if (result.error) return result
  const items = Array.isArray(result) ? [...result] : []
  return shuffleArray(items).slice(0, 8)
}

/**
 * Œuvres "gérées" — concept supprimé dans la nouvelle architecture.
 * Retourne une liste vide pour la compatibilité ascendante.
 *
 * @returns {Promise<{ data: [] }>}
 */
export async function getManagedArtworks() {
  return { data: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRITURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/artworks — Soumet une nouvelle œuvre.
 * Upload l'image vers Supabase Storage avant l'envoi.
 *
 * @param {FormData} data
 * @returns {Promise<object | { error: string }>}
 */
export async function submitArtwork(data) {
  try {
    const { supabase } = await import('../lib/supabase')
    const { uploadArtworkImage } = await import('../lib/storage')
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''
    const userId = sessionData.session?.user?.id

    const fields = {}
    for (const [key, value] of data.entries()) fields[key] = value

    if ('forSale' in fields) {
      fields.for_sale = fields.forSale
      delete fields.forSale
    }
    if ('availabilityStatus' in fields) {
      fields.availability_status = fields.availabilityStatus
      delete fields.availabilityStatus
    }

    if (fields.image instanceof File && userId) {
      const upload = await uploadArtworkImage(userId, fields.image)
      if (upload.error) return { error: upload.error }
      fields.image = upload.url
    }

    const response = await fetch(`${api}/artworks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'kcb-api-key': import.meta.env.VITE_API_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(fields),
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * PUT /api/artworks/:id — Mise à jour d'une œuvre.
 * Upload l'image si c'est un File.
 *
 * @param {string}   id
 * @param {FormData} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function updateArtwork(id, payload) {
  try {
    const { supabase } = await import('../lib/supabase')
    const { uploadArtworkImage, uploadFile } = await import('../lib/storage')
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''
    const userId = sessionData.session?.user?.id

    const fields = {}
    for (const [key, value] of payload.entries()) fields[key] = value

    if (fields.image instanceof File && userId) {
      // Utilise un path stable basé sur l'id de l'œuvre pour écraser l'ancienne image
      const ext = fields.image.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const upload = await uploadFile({
        bucket: 'artworks',
        path: `${userId}/${id}.${ext}`,
        file: fields.image,
      })
      if (upload.error) return { error: upload.error }
      fields.image = upload.url
    }

    const response = await fetch(`${api}/artworks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'kcb-api-key': import.meta.env.VITE_API_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(fields),
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * PATCH /api/artworks/:id — Change le statut d'une œuvre (admin).
 *
 * @param {string} id
 * @param {string} status - 'approved' | 'rejected' | 'pending'
 * @returns {Promise<object | { error: string }>}
 */
export async function setArtworkStatus(id, status) {
  try {
    const response = await fetch(`${api}/artworks/${id}`, {
      ...utils.options,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * PUT /api/artworks/:id — Met à jour le champ etherscan d'une œuvre.
 *
 * @param {string} id
 * @param {string} etherscan
 * @returns {Promise<object | { error: string }>}
 */
export async function updateEtherscan(id, etherscan) {
  try {
    const response = await fetch(`${api}/artworks/${id}`, {
      ...utils.options,
      method: 'PUT',
      body: JSON.stringify({ etherscan }),
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * DELETE /api/artworks/:id — Supprime une œuvre (admin).
 *
 * @param {string} id
 * @returns {Promise<{ deleted: true } | { error: string }>}
 */
export async function deleteArtwork(id) {
  try {
    const response = await fetch(`${api}/artworks/${id}`, {
      ...utils.options,
      method: 'DELETE',
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIKES — non implémentés dans la nouvelle API
// Stubs de compatibilité pour éviter les crashes silencieux.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Likes non implémentés — retourne une liste vide.
 *
 * @returns {Promise<{ data: [] }>}
 */
export async function getLikedArtworks() {
  return { data: [] }
}

/**
 * Like non implémenté — no-op.
 *
 * @returns {Promise<{ ok: true }>}
 */
export async function likeArtwork() {
  return { ok: true }
}

/**
 * Dislike non implémenté — no-op.
 *
 * @returns {Promise<{ ok: true }>}
 */
export async function dislikeArtwork() {
  return { ok: true }
}

/**
 * Achat via PayDunya — le flux est géré par /payments/paydunya-init.
 * Cette fonction est un stub de compatibilité.
 *
 * @returns {Promise<{ error: string }>}
 */
export async function purchaseArtwork() {
  return { error: 'Utilisez le flux PayDunya via /payments/paydunya-init' }
}
