/**
 * api/_modules/logidoo.js — Client de l'API Logidoo Expedition et outils de diagnostic.
 *
 * Contrat connu (documentation Logidoo, https://logidoo-ayeb.readme.io) :
 *   - Staging    : https://staging-expedition.logidoo.co/api/v1
 *   - Production : https://expedition.logidoo.co/api/v1
 *   - Authentification : en-tête `Authorization: Bearer <token>` (token généré dans le backoffice
 *     Logidoo, Settings > API)
 *   - Expédition  : POST/GET /expedition, GET/DELETE /expedition/{id}
 *   - Opérations  : POST/GET /operations, GET/DELETE /operations/{id}
 *   - Suivi       : GET /expedition-tracking/{trackingNumber}  → activityLog[]
 *   - Nœuds       : GET /node?countryCode=SN, GET /node/{id}
 *   - Transporteurs : GET /carrier
 *
 * NON documenté (donc non supposé ici) : noms exacts des champs expéditeur / destinataire / lieux,
 * schémas de réponse de /node et /carrier, contenu des webhooks, vocabulaire des statuts.
 * Les routes de diagnostic (status, probe, webhooks) servent à relever ces formes sur le staging réel.
 *
 * Variables d'environnement :
 *   LOGIDOO_API_KEY         token Bearer
 *   LOGIDOO_ENV             `production` pour la production ; toute autre valeur = staging (par prudence)
 *   LOGIDOO_WEBHOOK_SECRET  secret de l'URL du webhook (?secret=…) ; sans lui, le webhook est refusé
 *   LOGIDOO_BASE_URL        (optionnel, tests) remplace l'URL de base
 */

import crypto from 'node:crypto'

const BASE_URLS = {
  staging: 'https://staging-expedition.logidoo.co/api/v1',
  production: 'https://expedition.logidoo.co/api/v1',
}

// Les Vercel Functions sont limitées à 10 s : on coupe l'appel Logidoo avant
const DEFAULT_TIMEOUT_MS = 8000

export const logidooConfig = (env = process.env) => {
  const token = String(env.LOGIDOO_API_KEY || '').trim()
  const mode = String(env.LOGIDOO_ENV || '').trim().toLowerCase() === 'production' ? 'production' : 'staging'
  const override = String(env.LOGIDOO_BASE_URL || '').trim().replace(/\/+$/, '')
  return { configured: token.length > 0, mode, baseUrl: override || BASE_URLS[mode], token }
}

export class LogidooError extends Error {
  constructor(message, { status = 0, code = 'LOGIDOO_ERROR', body = null } = {}) {
    super(message)
    this.name = 'LogidooError'
    this.status = status
    this.code = code
    this.body = body
  }
}

const clip = (value, max = 1000) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** Appel HTTP vers Logidoo. Le token n'apparaît jamais dans une erreur ni dans un journal. */
export async function logidooRequest(cfg, method, path, { query, body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!cfg.configured) throw new LogidooError('LOGIDOO_API_KEY manquante', { code: 'NOT_CONFIGURED' })

  const url = new URL(`${cfg.baseUrl}${path}`)
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new LogidooError(`Logidoo n'a pas répondu en ${timeoutMs / 1000} s`, { code: 'TIMEOUT' })
    throw new LogidooError(`Logidoo injoignable : ${err?.cause?.code || err?.message || 'erreur réseau'}`, { code: 'NETWORK' })
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text().catch(() => '')
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : response.status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR'
    throw new LogidooError(`Logidoo a répondu HTTP ${response.status}`, { status: response.status, code, body: clip(data) })
  }
  return data
}

const enc = encodeURIComponent

/** Fonctions métier : un appel par endpoint documenté. */
export const createLogidooClient = (cfg = logidooConfig()) => ({
  config: cfg,
  listNodes: (countryCode) => logidooRequest(cfg, 'GET', '/node', { query: { countryCode } }),
  getNode: (id) => logidooRequest(cfg, 'GET', `/node/${enc(id)}`),
  listCarriers: () => logidooRequest(cfg, 'GET', '/carrier'),
  listExpeditions: (query) => logidooRequest(cfg, 'GET', '/expedition', { query }),
  getExpedition: (id) => logidooRequest(cfg, 'GET', `/expedition/${enc(id)}`),
  createExpedition: (payload) => logidooRequest(cfg, 'POST', '/expedition', { body: payload }),
  cancelExpedition: (id) => logidooRequest(cfg, 'DELETE', `/expedition/${enc(id)}`),
  listOperations: (query) => logidooRequest(cfg, 'GET', '/operations', { query }),
  getTracking: (trackingNumber) => logidooRequest(cfg, 'GET', `/expedition-tracking/${enc(trackingNumber)}`),
})

/** Traduit une erreur Logidoo en réponse HTTP exploitable par l'interface. */
export const logidooErrorResponse = (err) => {
  if (err?.code === 'NOT_CONFIGURED') return { status: 503, error: 'Intégration Logidoo non configurée : LOGIDOO_API_KEY manquante côté serveur' }
  if (err?.code === 'UNAUTHORIZED') return { status: 502, error: 'Logidoo a refusé le jeton : vérifier LOGIDOO_API_KEY et LOGIDOO_ENV (staging ou production)' }
  if (err?.code === 'TIMEOUT') return { status: 504, error: err.message }
  if (err?.code === 'NETWORK') return { status: 502, error: err.message }
  if (err?.code === 'NOT_FOUND') return { status: 404, error: 'Introuvable chez Logidoo' }
  return { status: 502, error: err?.message || 'Erreur Logidoo' }
}

const VOCABULARY_KEY = /status|statut|state|stage|mode|type|currency|devise|country|pays/i

/**
 * Décrit la FORME d'une réponse sans en exposer les valeurs (pas de données personnelles dans les
 * retours de diagnostic). Seules les valeurs courtes de clés « de vocabulaire » (statut, mode, type…)
 * sont conservées, pour découvrir les statuts réellement utilisés.
 */
export const describeShape = (value, key = '', depth = 0) => {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length, item: value.length ? describeShape(value[0], key, depth + 1) : null }
  }
  if (typeof value === 'object') {
    if (depth >= 4) return 'object'
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, describeShape(v, k, depth + 1)]))
  }
  if (typeof value === 'string' && VOCABULARY_KEY.test(key) && value.length <= 40) return { type: 'string', value }
  return typeof value
}

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

const WEBHOOK_HEADERS = /^(content-type|user-agent|x-[a-z0-9-]+)$/i
const MAX_WEBHOOK_BYTES = 100_000

/**
 * Routes /api/logistics/logidoo/* :
 *   GET  status[?check=1]   configuration + test de connexion authentifié (admin)
 *   GET  probe              forme des réponses /node, /carrier, /expedition, /operations (admin)
 *   POST webhook?secret=    réception des webhooks Logidoo, payload brut conservé (public, secret requis)
 *   GET  webhooks           derniers webhooks reçus (admin)
 * Renvoie true quand la requête a reçu une réponse.
 */
export async function handleLogidooRoutes({ req, res, path, supabaseAdmin, adminOnly, client = createLogidooClient() }) {
  const [, , action] = path // logistics / logidoo / <action>
  const method = req.method
  const send = (status, body) => { res.status(status).json(body); return true }

  // Webhook entrant : pas de session, protégé par un secret dans l'URL
  if (method === 'POST' && action === 'webhook') {
    const expected = process.env.LOGIDOO_WEBHOOK_SECRET
    if (!expected) return send(503, { success: false, error: 'Webhook non configuré (LOGIDOO_WEBHOOK_SECRET manquant)' })
    if (!safeEqual(req.query?.secret ?? '', expected)) return send(401, { success: false, error: 'Secret invalide' })
    const payload = req.body
    if (payload === undefined || payload === null || payload === '') return send(400, { success: false, error: 'Corps vide' })
    if (JSON.stringify(payload).length > MAX_WEBHOOK_BYTES) return send(413, { success: false, error: 'Corps trop volumineux' })
    const headers = Object.fromEntries(Object.entries(req.headers || {}).filter(([k]) => WEBHOOK_HEADERS.test(k)))
    const { error } = await supabaseAdmin.from('logidoo_webhook_events').insert({ payload, headers })
    if (error) return send(500, { success: false, error: /logidoo_webhook_events/.test(error.message) ? 'Table absente : appliquer supabase/migrations/037_logidoo_webhook_events.sql' : error.message })
    return send(200, { success: true })
  }

  if (adminOnly()) return true

  if (method === 'GET' && action === 'status') {
    const cfg = client.config
    const status = {
      configured: cfg.configured,
      environment: cfg.mode,
      baseUrl: cfg.baseUrl,
      webhook: { configured: Boolean(process.env.LOGIDOO_WEBHOOK_SECRET) },
    }
    if (req.query?.check === '1') {
      const startedAt = Date.now()
      try {
        await client.listNodes(req.query?.country || 'SN')
        status.check = { ok: true, latencyMs: Date.now() - startedAt }
      } catch (err) {
        status.check = { ok: false, latencyMs: Date.now() - startedAt, ...logidooErrorResponse(err), httpStatus: err?.status || null }
      }
    }
    return send(200, { success: true, ...status })
  }

  if (method === 'GET' && action === 'probe') {
    const country = String(req.query?.country || 'SN').slice(0, 2).toUpperCase()
    const trackingNumber = req.query?.trackingNumber ? String(req.query.trackingNumber).slice(0, 80) : null
    const calls = {
      [`GET /node?countryCode=${country}`]: () => client.listNodes(country),
      'GET /carrier': () => client.listCarriers(),
      'GET /expedition': () => client.listExpeditions(),
      'GET /operations': () => client.listOperations(),
      ...(trackingNumber ? { 'GET /expedition-tracking/{trackingNumber}': () => client.getTracking(trackingNumber) } : {}),
    }
    if (!client.config.configured) return send(503, { success: false, error: logidooErrorResponse(new LogidooError('', { code: 'NOT_CONFIGURED' })).error })
    const results = {}
    for (const [label, run] of Object.entries(calls)) {
      try {
        results[label] = { ok: true, shape: describeShape(await run()) }
      } catch (err) {
        results[label] = { ok: false, httpStatus: err?.status || null, ...logidooErrorResponse(err) }
      }
    }
    return send(200, { success: true, environment: client.config.mode, note: 'Formes seulement : aucune valeur personnelle n’est renvoyée', results })
  }

  if (method === 'GET' && action === 'webhooks') {
    const { data, error } = await supabaseAdmin
      .from('logidoo_webhook_events').select('id, payload, headers, received_at').order('received_at', { ascending: false }).limit(50)
    if (error) return send(500, { success: false, error: /logidoo_webhook_events/.test(error.message) ? 'Table absente : appliquer supabase/migrations/037_logidoo_webhook_events.sql' : error.message })
    return send(200, { success: true, events: data || [] })
  }

  return false
}
