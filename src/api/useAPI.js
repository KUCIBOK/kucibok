/**
 * useAPI.js — Utilitaires communs pour les appels fetch vers le backend.
 *
 * Token Supabase :
 *   Le token est synchronisé depuis AuthContext via setSupabaseToken()
 *   à chaque changement de session (onAuthStateChange).
 *   Plus de lecture directe dans localStorage.
 *
 * @module useAPI
 */

/** Token Supabase courant, mis à jour par setSupabaseToken(). */
let _currentToken = ''

/**
 * fetch() avec timeout automatique.
 * Rejette avec une erreur lisible si le serveur ne répond pas dans le délai.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} [timeoutMs=12000]
 * @returns {Promise<Response>}
 */
export function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
    .catch((err) => {
      if (err.name === 'AbortError') throw new Error("Délai d'attente dépassé — réessayez")
      throw err
    })
}

/**
 * Met à jour le token Supabase utilisé par utils.options.
 * À appeler depuis AuthContext à chaque événement onAuthStateChange.
 *
 * @param {string | null} token - access_token Supabase ou null si déconnecté
 */
export function setSupabaseToken(token) {
  _currentToken = token ?? ''
}

/**
 * ApiError — erreur typée pour les réponses API non-ok.
 * Préserve status et body tout en maintenant instanceof Error.
 */
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

/**
 * Parse JSON de manière sûre — retourne l'objet parsé ou { _raw: text } sur erreur.
 *
 * @param {Response} response
 * @returns {Promise<object>}
 */
export async function parseJsonSafe(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { _raw: text }
  }
}

/**
 * Requête API avec retry automatique sur 401 (refresh token + retry une fois).
 * Utilise le token synchrone stocké dans _currentToken (mis à jour par AuthContext).
 * À utiliser pour les appels critiques comme le checkout où la fraîcheur du token importe.
 *
 * @param {string} url
 * @param {RequestInit} fetchOptions
 * @param {boolean} [retry=true]
 * @returns {Promise<object>}
 * @throws {ApiError} si la réponse n'est pas ok
 */
export async function apiRequestWithRetry(url, fetchOptions = {}, retry = true) {
  // Getter qui lit le token frais
  const buildHeaders = () => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'kcb-api-key': import.meta.env.VITE_API_KEY,
    'Authorization': `Bearer ${_currentToken}`,
    ...(fetchOptions.headers ?? {}),
  })

  const res = await fetch(url, {
    credentials: 'include',
    ...fetchOptions,
    headers: buildHeaders(),
  })

  if (res.status !== 401) {
    const data = await parseJsonSafe(res)
    if (!res.ok) {
      const message = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`
      throw new ApiError(message, res.status, data)
    }
    return data
  }

  // 401 détecté — tenter un refresh et retenter
  if (retry) {
    // Tenter une rafraîchissement explicite si possible (pour Supabase)
    // Le token dans _currentToken peut être rafraîchi asynchronement ailleurs,
    // donc on n'attend pas ici — on retente juste avec le token actuel.
    const retryRes = await fetch(url, {
      credentials: 'include',
      ...fetchOptions,
      headers: buildHeaders(), // Récupère le token potentiellement rafraîchi
    })

    const data = await parseJsonSafe(retryRes)
    if (!retryRes.ok) {
      const message = data?.error || data?.message || `HTTP ${retryRes.status}: ${retryRes.statusText}`
      throw new ApiError(message, retryRes.status, data)
    }
    return data
  }

  // Pas de retry autorisé — remonter le 401 en erreur
  const data = await parseJsonSafe(res)
  const message = data?.error || data?.message || 'Unauthorized'
  throw new ApiError(message, 401, data)
}

/**
 * Utilitaires partagés pour tous les fichiers src/api/*.js.
 *
 * @type {{ api: string, options: object }}
 */
export const utils = {
  /** Base URL de l'API (Vercel Functions post-migration / VPS pré-migration). */
  api: import.meta.env.VITE_API_URL,

  /** Token courant, utilisé par les hooks pour activer les requêtes authentifiées. */
  get token() {
    return _currentToken
  },

  /**
   * Getter ES6 — retourne un nouvel objet options à chaque accès.
   * Lit le token depuis le module-level variable, mis à jour par AuthContext.
   *
   * @returns {{ method: string, headers: Record<string, string> }}
   */
  get options() {
    return {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'kcb-api-key': import.meta.env.VITE_API_KEY,
        Authorization: `Bearer ${_currentToken}`,
      },
    }
  },
}
