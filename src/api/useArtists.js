/**
 * useArtists.js — Fonctions d'appel API pour les artistes.
 *
 * Auth : token Supabase récupéré à chaque appel via getSession() (stateless).
 * Storage : images uploadées vers Supabase Storage avant envoi au backend.
 *
 * @module useArtists
 */

import { supabase } from '../lib/supabase'
import { uploadProfileImage } from '../lib/storage'
import { utils } from './useAPI'

const { api } = utils

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PRIVÉS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne les headers d'auth Supabase pour les requêtes protégées.
 *
 * @returns {Promise<Record<string, string>>}
 */
async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ''
  return {
    'Content-Type': 'application/json',
    'kcb-api-key': import.meta.env.VITE_API_KEY,
    Authorization: `Bearer ${token}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Récupère tous les artistes.
 *
 * @returns {Promise<object[] | { error: string }>}
 */
export async function getAllArtists(params = {}) {
  try {
    const qs = new URLSearchParams(params).toString()
    const response = await fetch(`${api}/artist${qs ? `?${qs}` : ''}`, { ...utils.options })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Récupère un artiste par son ID et incrémente son compteur de visites.
 *
 * @param {string} id
 * @returns {Promise<object | { error: string }>}
 */
export async function getArtistAndUpdateVisited(id) {
  // La nouvelle API incrémente les visites automatiquement dans GET /api/artist/:id
  return getArtistById(id)
}

/**
 * Récupère un artiste par son ID.
 *
 * @param {string} id
 * @returns {Promise<object | { error: string }>}
 */
export async function getArtistById(id) {
  try {
    const response = await fetch(`${api}/artist/${id}`, { ...utils.options })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Artiste introuvable' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Récupère les artistes gérés par un professionnel.
 *
 * @param {string} id - ID du professionnel
 * @returns {Promise<object[] | { error: string }>}
 */
/**
 * Artistes gérés — concept supprimé dans la nouvelle architecture.
 * Retourne une liste vide pour la compatibilité ascendante.
 *
 * @returns {Promise<{ data: [] }>}
 */
export async function getManagedArtists() {
  return { data: [] }
}

/**
 * Récupère une sélection aléatoire d'artistes mis en avant.
 *
 * @returns {Promise<object[] | { error: string }>}
 */
export async function getFeaturedArtists() {
  try {
    const response = await fetch(`${api}/artist?random=true`, { ...utils.options })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRITURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un profil artiste. Si le payload (FormData) contient une image File,
 * elle est uploadée vers Supabase Storage et remplacée par son URL publique.
 *
 * @param {FormData} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function createArtist(payload) {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id

    const fields = {}
    let imageFile = null

    // ✅ FIX: Iterate FormData and convert values back to proper types
    for (const [key, value] of payload.entries()) {
      if (value instanceof File) {
        imageFile = value
      } else {
        if (value === 'true') fields[key] = true
        else if (value === 'false') fields[key] = false
        else if (!isNaN(value) && value !== '') fields[key] = parseFloat(value)
        else fields[key] = value
      }
    }

    // ✅ FIX: Upload image BEFORE sending JSON (if present)
    if (imageFile && userId) {
      const uploadResult = await uploadProfileImage(userId, imageFile)
      if (uploadResult.error) return { error: uploadResult.error }
      fields.image = uploadResult.url
    }

    const headers = await authHeaders()
    const response = await fetch(`${api}/artist`, {
      method: 'POST',
      headers,
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
 * Met à jour un profil artiste. Si le payload (FormData) contient une image File,
 * elle est uploadée vers Supabase Storage et remplacée par son URL publique.
 *
 * @param {string} id - ID artiste (Supabase UUID)
 * @param {FormData} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function updateArtist(id, payload) {
  try {
    const fields = {}
    let imageFile = null

    // ✅ FIX: Iterate FormData and convert values back to proper types
    // FormData converts everything to strings, so we need to parse them back
    for (const [key, value] of payload.entries()) {
      if (value instanceof File) {
        imageFile = value
      } else {
        // Try to parse back to original types
        if (value === 'true') fields[key] = true
        else if (value === 'false') fields[key] = false
        else if (!isNaN(value) && value !== '') fields[key] = parseFloat(value)
        else fields[key] = value
      }
    }

    // ✅ FIX: Upload image BEFORE sending JSON (if present)
    if (imageFile) {
      const uploadResult = await uploadProfileImage(id, imageFile)
      if (uploadResult.error) return { error: uploadResult.error }
      fields.image = uploadResult.url
    }

    const headers = await authHeaders()
    const response = await fetch(`${api}/artist/${id}`, {
      method: 'PUT',
      headers,
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
 * Met à jour un artiste géré par un professionnel.
 *
 * @param {string} id - ID de la relation managed artist
 * @param {FormData} payload
 * @returns {Promise<object | { error: string }>}
 */
/**
 * Mise à jour artiste géré — non implémentée dans la nouvelle architecture.
 * Utiliser updateArtist() directement.
 *
 * @param {string}   id
 * @param {FormData} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function updateManagedArtist(id, payload) {
  return updateArtist(id, payload)
}
