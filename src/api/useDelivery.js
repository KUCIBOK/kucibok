/**
 * useDelivery.js — Fonctions d'appel API pour les livraisons (F2).
 *
 * @module useDelivery
 */

import { utils } from './useAPI'

const { api } = utils

/**
 * GET /api/delivery/track/:trackingId — Tracking public (sans auth).
 *
 * @param {string} trackingId
 * @returns {Promise<object | { error: string }>}
 */
export async function getDeliveryByTracking(trackingId) {
  try {
    const response = await fetch(`${api}/delivery/track/${trackingId}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Numéro de suivi introuvable' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * GET /api/delivery — Liste des livraisons (filtré par user côté API si non-admin).
 *
 * @returns {Promise<{ data: object[], pagination: object } | { error: string }>}
 */
export async function getDeliveries() {
  try {
    const response = await fetch(`${api}/delivery`, { ...utils.options })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * GET /api/delivery — Mes livraisons (alias de getDeliveries — le filtre est côté API).
 *
 * @returns {Promise<{ data: object[], pagination: object } | { error: string }>}
 */
export async function getMyDeliveries() {
  return getDeliveries()
}

/**
 * GET /api/delivery/:id — Détail d'une livraison.
 *
 * @param {string} id
 * @returns {Promise<object | { error: string }>}
 */
export async function getDelivery(id) {
  try {
    const response = await fetch(`${api}/delivery/${id}`, { ...utils.options })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Livraison introuvable' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * POST /api/delivery — Crée une demande de livraison.
 *
 * @param {object} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function createDelivery(payload) {
  try {
    const response = await fetch(`${api}/delivery`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * PATCH /api/delivery/:id — Met à jour le statut d'une livraison (admin).
 *
 * @param {string} id
 * @param {{ status?: string, note?: string }} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function changeDeliveryStatus(id, payload) {
  try {
    const response = await fetch(`${api}/delivery/${id}`, {
      ...utils.options,
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur' }
    return body?.data ?? body
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * PATCH /api/delivery/:id — Alias de changeDeliveryStatus.
 *
 * @param {string} id
 * @param {object} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function updateDelivery(id, payload) {
  return changeDeliveryStatus(id, payload)
}

/**
 * DELETE /api/delivery/:id — Supprime une livraison (admin).
 *
 * @param {string} id
 * @returns {Promise<{ deleted: true } | { error: string }>}
 */
export async function deleteDelivery(id) {
  try {
    const response = await fetch(`${api}/delivery/${id}`, {
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

/**
 * POST /api/logistics/expeditions/:id/validate — L'admin valide la demande : l'expédition est créée
 * chez Logidoo, le coût et le suivi sont enregistrés, le demandeur est prévenu.
 *
 * @param {string} id
 * @returns {Promise<object | { error: string, missing?: string[] }>}
 */
export async function validateDelivery(id) {
  try {
    const response = await fetch(`${api}/logistics/expeditions/${id}/validate`, { ...utils.options, method: 'POST' })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur serveur', missing: body?.missing }
    return body?.expedition ?? body
  } catch (err) {
    return { error: err.message }
  }
}
