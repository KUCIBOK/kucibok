/**
 * api/_modules/extra-routes.js — Routes appelées par le front et jusqu'ici absentes du serveur.
 *
 * Appelé en dernier par api/[...path].js : `handleExtraRoutes(ctx)` renvoie true quand il a répondu,
 * false pour laisser le handler principal renvoyer son 404. Aucune donnée de remplacement :
 * chaque route lit ou écrit la base, ou répond par une erreur explicite.
 *
 * Routes : notifications, galleries (+ import CSV), delivery/:id, numerisation, subscriptions/current,
 * subscription/cancel, transactions (admin), support-tickets (admin), sourcing, auth (mot de passe,
 * gestion des utilisateurs).
 */

import { createClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_PASSWORD = 8

/** Crée une notification in-app pour un utilisateur ; n'échoue jamais (la table peut manquer). */
export const createNotifier = (supabaseAdmin) => async (userId, notification) => {
  const { type = 'info', severity = 'info', title, message = '', metadata = {} } = notification || {}
  if (!userId || !title) return
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({ user_id: userId, type, severity, title, message, metadata })
    if (error) console.warn('[notify] insertion impossible:', error.message)
  } catch (err) {
    console.warn('[notify] exception:', err.message)
  }
}

const toNotification = (row) => ({
  ...row,
  _id: row.id,
  time: row.created_at ? new Date(row.created_at).toLocaleString('fr-FR') : '',
})

/** Lit le corps brut d'une requête (multipart non analysé par Vercel). */
const readRawBody = async (req) => {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  if (req.body && typeof req.body === 'object' && !(Symbol.asyncIterator in req)) return null
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

/** Analyse un corps multipart/form-data : champs texte et fichiers. */
export const parseMultipart = (buffer, contentType) => {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
  if (!boundary || !buffer) return null
  const delimiter = Buffer.from(`--${boundary[1] || boundary[2]}`)
  const fields = {}
  const files = []
  let start = buffer.indexOf(delimiter)
  while (start !== -1) {
    const next = buffer.indexOf(delimiter, start + delimiter.length)
    if (next === -1) break
    const part = buffer.subarray(start + delimiter.length, next)
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8')
      const name = /name="([^"]*)"/i.exec(headers)?.[1]
      const filename = /filename="([^"]*)"/i.exec(headers)?.[1]
      let content = part.subarray(headerEnd + 4)
      if (content.subarray(-2).toString() === '\r\n') content = content.subarray(0, -2)
      if (filename !== undefined) {
        const mime = /content-type:\s*([^\r\n;]+)/i.exec(headers)?.[1]?.trim() || 'application/octet-stream'
        files.push({ name, filename, contentType: mime, content })
      } else if (name) {
        fields[name] = content.toString('utf8')
      }
    }
    start = next
  }
  return { fields, files }
}

/** Extrait le premier fichier d'un corps multipart/form-data. */
export const parseMultipartFile = (buffer, contentType) => {
  const parsed = parseMultipart(buffer, contentType)
  return parsed?.files[0] ? { filename: parsed.files[0].filename, content: parsed.files[0].content } : null
}

/** Analyse CSV minimale (guillemets, virgules ou points-virgules). */
export const parseCsv = (text) => {
  const clean = text.replace(/^﻿/, '')
  const delimiter = (clean.split('\n', 1)[0].match(/;/g) || []).length > (clean.split('\n', 1)[0].match(/,/g) || []).length ? ';' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((v) => v.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v.trim() !== '')) rows.push(row)
  return rows
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param {object} ctx
 * @param {object} ctx.req
 * @param {object} ctx.res
 * @param {string[]} ctx.path          segments d'URL après /api/
 * @param {object} ctx.supabaseAdmin
 * @param {Function} ctx.checkAuth
 * @param {Function} ctx.createExpedition  (user, payload) => { status, error | expedition }
 * @param {Function} ctx.toDeliveryClient
 * @param {Function} ctx.sendAdminNotification
 * @returns {Promise<boolean>}
 */
export async function handleExtraRoutes(ctx) {
  const { req, res, path, supabaseAdmin, checkAuth } = ctx
  const [s0, s1, s2, s3] = path
  const method = req.method
  const send = (status, body) => { res.status(status).json(body); return true }

  const authenticate = async () => {
    const auth = await checkAuth(req)
    if (auth.error) { send(auth.status || 401, { error: auth.error }); return null }
    return auth
  }
  const authenticateAdmin = async () => {
    const auth = await authenticate()
    if (!auth) return null
    if (auth.role !== 'admin') { send(403, { error: 'Admin access required' }); return null }
    return auth
  }
  const dbError = (err) => send(500, { error: err.message || 'Database error' })

  // ─── Notifications ─────────────────────────────────────────────────────────
  if (s0 === 'notifications') {
    if (method === 'GET' && !s1) {
      const auth = await authenticate(); if (!auth) return true
      const { data, error } = await supabaseAdmin
        .from('notifications').select('*').eq('user_id', auth.userId)
        .order('created_at', { ascending: false }).limit(100)
      if (error) return dbError(error)
      return send(200, { success: true, data: (data || []).map(toNotification) })
    }
    if (method === 'PATCH' && s1 === 'read-all') {
      const auth = await authenticate(); if (!auth) return true
      const { error } = await supabaseAdmin.from('notifications').update({ read: true }).eq('user_id', auth.userId).eq('read', false)
      if (error) return dbError(error)
      return send(200, { success: true })
    }
    if (method === 'PATCH' && s1 && s2 === 'read') {
      const auth = await authenticate(); if (!auth) return true
      if (!UUID_RE.test(s1)) return send(400, { error: 'Invalid notification id' })
      const { data, error } = await supabaseAdmin
        .from('notifications').update({ read: true }).eq('id', s1).eq('user_id', auth.userId).select('id').maybeSingle()
      if (error) return dbError(error)
      if (!data) return send(404, { error: 'Notification not found' })
      return send(200, { success: true })
    }
    if (method === 'DELETE' && !s1) {
      const auth = await authenticate(); if (!auth) return true
      const { error } = await supabaseAdmin.from('notifications').delete().eq('user_id', auth.userId)
      if (error) return dbError(error)
      return send(200, { success: true })
    }
    if (method === 'DELETE' && s1 && UUID_RE.test(s1)) {
      const auth = await authenticate(); if (!auth) return true
      const { data, error } = await supabaseAdmin
        .from('notifications').delete().eq('id', s1).eq('user_id', auth.userId).select('id')
      if (error) return dbError(error)
      if (!data?.length) return send(404, { error: 'Notification not found' })
      return send(200, { success: true })
    }
    return false
  }

  // ─── Galeries (admin) ──────────────────────────────────────────────────────
  if (s0 === 'galleries') {
    if (method === 'GET' && !s1) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { data, error } = await supabaseAdmin
        .from('galleries').select('id, name, email, location, website, created_at').order('name', { ascending: true }).limit(5000)
      if (error) return dbError(error)
      const galleries = (data || []).map((g) => ({ ...g, _id: g.id }))
      return send(200, { success: true, galleries, total: galleries.length, filtered: galleries.length, data: { galleries, total: galleries.length, filtered: galleries.length } })
    }
    if (method === 'POST' && s1 === 'import') {
      const admin = await authenticateAdmin(); if (!admin) return true
      let records = []
      const contentType = req.headers?.['content-type'] || ''
      if (/application\/json/i.test(contentType) && Array.isArray(req.body?.rows)) {
        records = req.body.rows.map((r) => ({ name: String(r?.name ?? '').trim(), email: String(r?.email ?? '').trim().toLowerCase() }))
      } else {
        const file = parseMultipartFile(await readRawBody(req), contentType)
        if (!file) return send(400, { error: 'Aucun fichier reçu (champ « file » attendu)' })
        if (!/\.(csv|txt)$/i.test(file.filename)) {
          return send(415, { error: 'Format non pris en charge : exporter le fichier au format CSV (colonnes name, email)' })
        }
        const rows = parseCsv(file.content.toString('utf8'))
        if (rows.length < 2) return send(400, { error: 'Fichier vide : une ligne d’en-tête et au moins une galerie sont attendues' })
        const header = rows[0].map((h) => h.trim().toLowerCase())
        const nameIdx = header.findIndex((h) => ['name', 'nom', 'gallery', 'galerie'].includes(h))
        const emailIdx = header.findIndex((h) => ['email', 'e-mail', 'mail', 'courriel'].includes(h))
        if (nameIdx === -1 || emailIdx === -1) {
          return send(400, { error: 'En-têtes attendus : name (ou nom) et email' })
        }
        records = rows.slice(1).map((r) => ({ name: (r[nameIdx] || '').trim(), email: (r[emailIdx] || '').trim().toLowerCase() }))
      }
      const valid = records.filter((r) => r.name && EMAIL_RE.test(r.email))
      const seen = new Set()
      const unique = valid.filter((r) => (seen.has(r.email) ? false : seen.add(r.email)))
      if (!unique.length) return send(400, { error: 'Aucune ligne valide (nom et e-mail requis)' })

      const { data: existing, error: existingError } = await supabaseAdmin.from('galleries').select('email').in('email', unique.map((r) => r.email))
      if (existingError) return dbError(existingError)
      const known = new Set((existing || []).map((g) => String(g.email).toLowerCase()))
      const fresh = unique.filter((r) => !known.has(r.email))
      if (fresh.length) {
        const { error } = await supabaseAdmin.from('galleries').insert(fresh)
        if (error) return dbError(error)
      }
      const skipped = records.length - fresh.length
      return send(200, {
        success: true, count: fresh.length, skipped,
        message: `${fresh.length} galerie(s) importée(s), ${skipped} ignorée(s) (doublons ou lignes invalides)`,
      })
    }
    return false
  }

  // ─── Livraisons : création, détail, statut, suppression ───────────────────
  if (s0 === 'delivery') {
    if (method === 'POST' && !s1) {
      const auth = await authenticate(); if (!auth) return true
      if (!['artist', 'curator', 'advisor', 'admin'].includes(auth.role)) {
        return send(403, { error: 'Only artists, curators, and advisors can create delivery requests' })
      }
      const b = req.body || {}
      if (!b.recipientName || !b.recipientPhone || !b.deliveryAddress) {
        return send(400, { error: 'recipientName, recipientPhone and deliveryAddress are required' })
      }
      const result = await ctx.createExpedition(auth.user, {
        recipient: { name: b.recipientName, phone: b.recipientPhone, address: b.deliveryAddress },
        package: { weight: b.packageWeight, size: b.packageSize },
        serviceType: b.deliveryPriority,
        collectionDate: b.collectDate,
        deliveryDate: b.deliveryDate,
        specialInstructions: b.specialInstructions,
        artwork_ids: b.artworkIds,
      })
      if (result.error) return send(result.status, { error: result.error })
      // Champs propres au corridor et à l'emballage
      const checklist = b.packagingChecklist || {}
      await supabaseAdmin.from('delivery_requests').update({
        corridor: b.corridor || 'AF_TO_FR',
        origin_country: b.originCountry || null,
        museum_wrap: !!checklist.museum_wrap,
        bubble_wrap: !!checklist.bubble_wrap,
        crate: !!checklist.crate,
        fragile_label: !!checklist.fragile_label,
        humidity_control: !!checklist.humidity_control,
      }).eq('id', result.expedition.id)
      return send(201, { success: true, data: { ...result.expedition, corridor: b.corridor || 'AF_TO_FR' } })
    }
    if (s1 && UUID_RE.test(s1) && !s2) {
      if (method === 'GET') {
        const auth = await authenticate(); if (!auth) return true
        const { data, error } = await supabaseAdmin.from('delivery_requests').select('*').eq('id', s1).maybeSingle()
        if (error) return dbError(error)
        if (!data || (auth.role !== 'admin' && data.user_id !== auth.userId)) return send(404, { error: 'Livraison introuvable' })
        const { data: events } = await supabaseAdmin.from('delivery_events').select('status, note, date').eq('delivery_id', s1).order('date', { ascending: true })
        return send(200, { success: true, data: { ...ctx.toDeliveryClient(data), events: events || [] } })
      }
      if (method === 'PATCH') {
        const admin = await authenticateAdmin(); if (!admin) return true
        const { status, note, delivery_date, price } = req.body || {}
        const STATUSES = ['pending', 'picked_up', 'in_transit', 'customs', 'delivered', 'cancelled', 'exception', 'failed']
        if (status !== undefined && !STATUSES.includes(status)) {
          return send(400, { error: `Invalid status. Must be one of: ${STATUSES.join(', ')}` })
        }
        const patch = {}
        if (status !== undefined) patch.status = status
        if (delivery_date !== undefined) patch.delivery_date = delivery_date
        if (price !== undefined && Number.isFinite(Number(price))) patch.price = Number(price)
        if (!Object.keys(patch).length) return send(400, { error: 'Nothing to update' })
        const { data, error } = await supabaseAdmin.from('delivery_requests').update(patch).eq('id', s1).select().maybeSingle()
        if (error) return dbError(error)
        if (!data) return send(404, { error: 'Livraison introuvable' })
        if (status !== undefined) {
          await supabaseAdmin.from('delivery_events').insert({ delivery_id: s1, status, note: note || '' })
        }
        return send(200, { success: true, data: ctx.toDeliveryClient(data) })
      }
      if (method === 'DELETE') {
        const admin = await authenticateAdmin(); if (!admin) return true
        const { data, error } = await supabaseAdmin.from('delivery_requests').delete().eq('id', s1).select('id')
        if (error) return dbError(error)
        if (!data?.length) return send(404, { error: 'Livraison introuvable' })
        return send(200, { success: true, data: { id: s1, _id: s1 } })
      }
    }
    return false
  }

  // ─── Numérisation (demandes de l'artiste) ─────────────────────────────────
  if (s0 === 'numerisation') {
    const shape = (r) => ({ ...r, _id: r.id })
    if (method === 'GET') {
      const auth = await authenticate(); if (!auth) return true
      let query = supabaseAdmin.from('numerisation_requests').select('*').order('created_at', { ascending: false }).limit(500)
      if (auth.role !== 'admin' || s1 === 'my') query = query.eq('user_id', auth.userId)
      const { data, error } = await query
      if (error) return dbError(error)
      return send(200, { success: true, data: (data || []).map(shape) })
    }
    if (method === 'POST' && !s1) {
      const auth = await authenticate(); if (!auth) return true
      const { artwork_id, artworkId, notes } = req.body || {}
      const targetId = artwork_id || artworkId
      if (!targetId || !UUID_RE.test(String(targetId))) return send(400, { error: 'artwork_id is required' })
      const { data: artwork } = await supabaseAdmin.from('artworks').select('id, user_id, owner_id').eq('id', targetId).maybeSingle()
      if (!artwork || (auth.role !== 'admin' && artwork.user_id !== auth.userId && artwork.owner_id !== auth.userId)) {
        return send(403, { error: 'The artwork must exist and belong to you' })
      }
      const { data, error } = await supabaseAdmin
        .from('numerisation_requests').insert({ user_id: auth.userId, artwork_id: targetId, status: 'pending', notes: notes ? String(notes).slice(0, 1000) : null }).select().single()
      if (error) return dbError(error)
      return send(201, { success: true, data: shape(data) })
    }
    if (s1 && UUID_RE.test(s1) && ['PATCH', 'PUT'].includes(method)) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const STATUSES = ['pending', 'in_progress', 'completed', 'rejected']
      const { status, notes } = req.body || {}
      if (status !== undefined && !STATUSES.includes(status)) return send(400, { error: `Invalid status. Must be one of: ${STATUSES.join(', ')}` })
      const patch = {}
      if (status !== undefined) patch.status = status
      if (notes !== undefined) patch.notes = String(notes).slice(0, 1000)
      if (!Object.keys(patch).length) return send(400, { error: 'Nothing to update' })
      const { data, error } = await supabaseAdmin.from('numerisation_requests').update(patch).eq('id', s1).select().maybeSingle()
      if (error) return dbError(error)
      if (!data) return send(404, { error: 'Request not found' })
      return send(200, { success: true, data: shape(data) })
    }
    if (s1 && UUID_RE.test(s1) && method === 'DELETE') {
      const auth = await authenticate(); if (!auth) return true
      const { data: existing } = await supabaseAdmin.from('numerisation_requests').select('id, user_id, status').eq('id', s1).maybeSingle()
      if (!existing) return send(404, { error: 'Request not found' })
      const isOwner = existing.user_id === auth.userId
      if (auth.role !== 'admin' && !(isOwner && existing.status === 'pending')) {
        return send(403, { error: 'Only pending requests can be deleted by their owner' })
      }
      const { error } = await supabaseAdmin.from('numerisation_requests').delete().eq('id', s1)
      if (error) return dbError(error)
      return send(200, { success: true, data: { id: s1, _id: s1 } })
    }
    return false
  }

  // ─── Abonnement de l'utilisateur ──────────────────────────────────────────
  if (s0 === 'subscriptions' && s1 === 'current' && method === 'GET') {
    const auth = await authenticate(); if (!auth) return true
    const { data, error } = await supabaseAdmin
      .from('subscriptions').select('*').eq('user_id', auth.userId)
      .in('status', ['active', 'trial', 'cancelled']).order('created_at', { ascending: false }).limit(1)
    if (error) return dbError(error)
    const current = (data || []).find((s) => !s.end_date || Date.parse(s.end_date) > Date.now())
    if (!current) return send(404, { error: 'No active subscription' })
    return send(200, current)
  }
  if (s0 === 'subscription' && s1 === 'cancel' && method === 'POST') {
    const auth = await authenticate(); if (!auth) return true
    const { data, error } = await supabaseAdmin
      .from('subscriptions').update({ status: 'cancelled' }).eq('user_id', auth.userId).in('status', ['active', 'trial']).select()
    if (error) return dbError(error)
    if (!data?.length) return send(404, { error: 'No active subscription to cancel' })
    // L'accès reste ouvert jusqu'à la fin de la période déjà payée (voir hasActiveAccess)
    return send(200, { success: true, data: data[0] })
  }

  // ─── Admin : transactions et support ──────────────────────────────────────
  if (s0 === 'transactions' && !s1 && method === 'GET') {
    const admin = await authenticateAdmin(); if (!admin) return true
    const { data, error } = await supabaseAdmin
      .from('transactions').select('id, artwork_id, buyer_id, seller_id, amount, currency, status, payment_method, created_at')
      .order('created_at', { ascending: false }).limit(1000)
    if (error) return dbError(error)
    return send(200, { success: true, data: (data || []).map((t) => ({ ...t, type: t.artwork_id ? 'artwork' : 'subscription' })) })
  }
  if (s0 === 'support-tickets' && s1 === 'admin' && s2 === 'stats' && method === 'GET') {
    const admin = await authenticateAdmin(); if (!admin) return true
    const { data, error } = await supabaseAdmin.from('support_tickets').select('status, priority')
    if (error) return dbError(error)
    const count = (key) => (data || []).reduce((acc, t) => ({ ...acc, [t[key]]: (acc[t[key]] || 0) + 1 }), {})
    return send(200, { success: true, stats: { total: (data || []).length, byStatus: count('status'), byPriority: count('priority') } })
  }
  if (s0 === 'support-tickets' && s1 === 'ticket' && s2 && method === 'GET') {
    const auth = await authenticate(); if (!auth) return true
    if (!UUID_RE.test(s2)) return send(400, { error: 'Invalid ticket id' })
    const { data, error } = await supabaseAdmin.from('support_tickets').select('*').eq('id', s2).maybeSingle()
    if (error) return dbError(error)
    if (!data || (auth.role !== 'admin' && data.user_id !== auth.userId)) return send(404, { error: 'Ticket not found' })
    return send(200, { success: true, ticket: { ...data, ticketId: data.id } })
  }

  // ─── Sourcing : demandes de l'utilisateur ─────────────────────────────────
  if (s0 === 'sourcing' && s1 === 'mine' && method === 'GET') {
    const auth = await authenticate(); if (!auth) return true
    const { data, error } = await supabaseAdmin
      .from('sourcing_inquiries').select('*').eq('requested_by', auth.userId).order('created_at', { ascending: false }).limit(200)
    if (error) return dbError(error)
    return send(200, { success: true, data: data || [] })
  }
  if (s0 === 'sourcing' && !s1 && method === 'POST') {
    const auth = await authenticate(); if (!auth) return true
    const { artwork_id, organization, purpose, budget, message } = req.body || {}
    if (!purpose || !message) return send(400, { error: 'Missing required fields: purpose, message' })
    const row = {
      requested_by: auth.userId,
      artwork_id: artwork_id && UUID_RE.test(String(artwork_id)) ? artwork_id : null,
      organization: organization ? String(organization).slice(0, 200) : null,
      purpose: String(purpose).slice(0, 200),
      budget: Number.isFinite(Number(budget)) ? Number(budget) : null,
      message: String(message).slice(0, 5000),
      status: 'pending',
    }
    const { data, error } = await supabaseAdmin.from('sourcing_inquiries').insert(row).select().single()
    if (error) return dbError(error)
    return send(201, { success: true, data })
  }

  // ─── Catégories ────────────────────────────────────────────────────────────
  if (s0 === 'category') {
    const shape = (c) => ({ ...c, _id: c.id, title: c.name })
    if (method === 'GET' && !s1) {
      const { data, error } = await supabaseAdmin.from('categories').select('id, name, image, created_at').order('name', { ascending: true }).limit(500)
      if (error) return dbError(error)
      return send(200, { success: true, data: (data || []).map(shape) })
    }
    if (method === 'POST' && !s1) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const name = String(req.body?.title ?? req.body?.name ?? '').trim()
      if (name.length < 2 || name.length > 60) return send(400, { error: 'Le nom de la catégorie doit contenir entre 2 et 60 caractères' })
      const { data, error } = await supabaseAdmin.from('categories').insert({ name, image: req.body?.image || null }).select().single()
      if (error?.code === '23505') return send(409, { error: 'Cette catégorie existe déjà' })
      if (error) return dbError(error)
      return send(201, { success: true, data: shape(data) })
    }
    if (method === 'DELETE' && s1 && UUID_RE.test(s1)) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { data, error } = await supabaseAdmin.from('categories').delete().eq('id', s1).select()
      if (error) return dbError(error)
      if (!data?.length) return send(404, { error: 'Catégorie introuvable' })
      return send(200, { success: true, data: shape(data[0]) })
    }
    return false
  }

  // ─── Plans d'abonnement ────────────────────────────────────────────────────
  if (s0 === 'plan') {
    const PLAN_ROLES = ['buyer', 'artist', 'curator', 'advisor']
    const CURRENCIES = ['XOF', 'USD', 'EUR']
    const DURATIONS = { monthly: 30, yearly: 365 }
    const shape = (p) => ({
      ...p, _id: p.id,
      duration: p.duration_days >= 365 ? 'yearly' : 'monthly',
      features: Array.isArray(p.features) ? p.features : [],
    })
    // Valide et convertit le corps du formulaire admin ; renvoie { error } ou { row }
    const readPlan = (body, partial) => {
      const row = {}
      if (!partial || body.name !== undefined) {
        const name = String(body.name ?? '').trim()
        if (name.length < 2 || name.length > 80) return { error: 'Le nom du plan doit contenir entre 2 et 80 caractères' }
        row.name = name
      }
      if (!partial || body.price !== undefined) {
        const price = Number(body.price)
        if (!Number.isFinite(price) || price < 0) return { error: 'Le prix doit être un nombre positif ou nul' }
        row.price = price
      }
      if (body.currency !== undefined) {
        if (!CURRENCIES.includes(body.currency)) return { error: `Devise invalide. Valeurs : ${CURRENCIES.join(', ')}` }
        row.currency = body.currency
      }
      if (body.duration !== undefined) {
        if (!(body.duration in DURATIONS)) return { error: 'Durée invalide. Valeurs : monthly, yearly' }
        row.duration_days = DURATIONS[body.duration]
      }
      if (body.role !== undefined) {
        if (body.role !== null && !PLAN_ROLES.includes(body.role)) return { error: `Rôle invalide. Valeurs : ${PLAN_ROLES.join(', ')}` }
        row.role = body.role
      }
      if (body.description !== undefined) row.description = body.description ? String(body.description).slice(0, 500) : null
      if (body.features !== undefined) {
        if (!Array.isArray(body.features) || body.features.length > 20 || body.features.some((f) => typeof f !== 'string' || !f.trim() || f.length > 120)) {
          return { error: 'features doit être une liste de 20 textes maximum (120 caractères chacun)' }
        }
        row.features = body.features.map((f) => f.trim())
      }
      if (body.is_active !== undefined) row.is_active = !!body.is_active
      return { row }
    }
    if (method === 'GET' && !s1) {
      // Visiteurs : plans actifs ; admin connecté : tous
      const viewer = await checkAuth(req)
      let query = supabaseAdmin.from('plans').select('*').order('price', { ascending: true }).limit(200)
      if (viewer.error || viewer.role !== 'admin') query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) return dbError(error)
      return send(200, { success: true, data: (data || []).map(shape) })
    }
    if (method === 'GET' && s1 && UUID_RE.test(s1)) {
      const { data, error } = await supabaseAdmin.from('plans').select('*').eq('id', s1).maybeSingle()
      if (error) return dbError(error)
      if (!data) return send(404, { error: 'Plan introuvable' })
      if (data.is_active === false) {
        const viewer = await checkAuth(req)
        if (viewer.error || viewer.role !== 'admin') return send(404, { error: 'Plan introuvable' })
      }
      return send(200, { success: true, data: shape(data) })
    }
    if (method === 'POST' && !s1) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { row, error: invalid } = readPlan(req.body || {}, false)
      if (invalid) return send(400, { error: invalid })
      const { data, error } = await supabaseAdmin.from('plans').insert({ currency: 'EUR', duration_days: 30, ...row }).select().single()
      if (error) return dbError(error)
      return send(201, { success: true, data: shape(data) })
    }
    if (method === 'PUT' && s1 && UUID_RE.test(s1)) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { row, error: invalid } = readPlan(req.body || {}, true)
      if (invalid) return send(400, { error: invalid })
      if (!Object.keys(row).length) return send(400, { error: 'Nothing to update' })
      const { data, error } = await supabaseAdmin.from('plans').update(row).eq('id', s1).select().maybeSingle()
      if (error) return dbError(error)
      if (!data) return send(404, { error: 'Plan introuvable' })
      return send(200, { success: true, data: shape(data) })
    }
    if (method === 'DELETE' && s1 && UUID_RE.test(s1)) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { data, error } = await supabaseAdmin.from('plans').delete().eq('id', s1).select()
      if (error?.code === '23503') return send(409, { error: 'Ce plan est utilisé par des abonnements : désactivez-le (is_active) plutôt que de le supprimer' })
      if (error) return dbError(error)
      if (!data?.length) return send(404, { error: 'Plan introuvable' })
      return send(200, { success: true, data: shape(data[0]) })
    }
    return false
  }

  // ─── Avis des professionnels sur les œuvres ───────────────────────────────
  if (s0 === 'review') {
    if (method === 'GET' && s1 === 'artwork' && s2 && UUID_RE.test(s2)) {
      const { data: artwork } = await supabaseAdmin.from('artworks').select('id, status').eq('id', s2).maybeSingle()
      if (!artwork || !['approved', 'sold'].includes(artwork.status)) return send(404, { error: 'Œuvre introuvable' })
      const { data, error } = await supabaseAdmin
        .from('reviews').select('id, artwork_id, professional_id, rating, comment, created_at').eq('artwork_id', s2).order('created_at', { ascending: false }).limit(200)
      if (error) return dbError(error)
      const ids = [...new Set((data || []).map((r) => r.professional_id))]
      const { data: authors } = ids.length ? await supabaseAdmin.from('users').select('id, name').in('id', ids) : { data: [] }
      const names = Object.fromEntries((authors || []).map((a) => [a.id, a.name]))
      return send(200, (data || []).map((r) => ({ ...r, _id: r.id, authorName: names[r.professional_id] || null })))
    }
    if (method === 'POST' && !s1) {
      const auth = await authenticate(); if (!auth) return true
      if (!['curator', 'advisor', 'admin'].includes(auth.role)) return send(403, { error: 'Seuls les curateurs et advisors peuvent publier un avis' })
      const { artwork_id, artworkId, rating, comment } = req.body || {}
      const targetId = artwork_id || artworkId
      if (!targetId || !UUID_RE.test(String(targetId))) return send(400, { error: 'artwork_id is required' })
      const score = Number(rating)
      if (!Number.isInteger(score) || score < 1 || score > 5) return send(400, { error: 'La note doit être un entier de 1 à 5' })
      const text = String(comment ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 2000)
      const { data: artwork } = await supabaseAdmin.from('artworks').select('id, status').eq('id', targetId).maybeSingle()
      if (!artwork || !['approved', 'sold'].includes(artwork.status)) return send(404, { error: 'Œuvre introuvable' })
      // Un seul avis par professionnel et par œuvre : le nouvel avis remplace l'ancien
      const { data: existing } = await supabaseAdmin.from('reviews').select('id').eq('artwork_id', targetId).eq('professional_id', auth.userId).maybeSingle()
      const { data, error } = existing
        ? await supabaseAdmin.from('reviews').update({ rating: score, comment: text || null }).eq('id', existing.id).select().single()
        : await supabaseAdmin.from('reviews').insert({ artwork_id: targetId, professional_id: auth.userId, rating: score, comment: text || null }).select().single()
      if (error) return dbError(error)
      return send(existing ? 200 : 201, { ...data, _id: data.id })
    }
    return false
  }

  // ─── Blog ──────────────────────────────────────────────────────────────────
  if (s0 === 'blog') {
    const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
    const MAX_IMAGE = 5 * 1024 * 1024
    const postShape = (p, comments) => ({
      ...p, _id: p.id,
      status: p.archived ? 'archived' : p.published ? 'published' : 'draft',
      authorId: p.user_id,
      visited: p.views ?? 0,
      publishDate: p.published_at || p.created_at,
      tags: Array.isArray(p.tags) ? p.tags : [],
      ...(comments ? { comments } : {}),
    })
    const listPosts = async (filter) => {
      let query = supabaseAdmin.from('blog_posts').select('*').order('created_at', { ascending: false }).limit(200)
      query = filter(query)
      const { data, error } = await query
      if (error) return dbError(error)
      return send(200, { success: true, data: (data || []).map((p) => postShape(p)) })
    }
    // Lit titre, extrait, contenu, tags et image d'un formulaire multipart ou JSON
    const readPostForm = async () => {
      const contentType = req.headers?.['content-type'] || ''
      let fields = {}
      let file = null
      if (/multipart\/form-data/i.test(contentType)) {
        const parsed = parseMultipart(await readRawBody(req), contentType)
        if (!parsed) return { error: 'Corps multipart illisible' }
        fields = parsed.fields
        file = parsed.files.find((f) => f.name === 'image' && f.content.length) || null
      } else fields = req.body || {}
      const out = {}
      if (fields.title !== undefined) {
        const title = String(fields.title).trim()
        if (title.length < 5 || title.length > 200) return { error: 'Le titre doit contenir entre 5 et 200 caractères' }
        out.title = title
      }
      if (fields.excerpt !== undefined) {
        const excerpt = String(fields.excerpt).replace(/<[^>]*>/g, '').trim()
        if (excerpt.length < 5 || excerpt.length > 500) return { error: 'L’extrait doit contenir entre 5 et 500 caractères' }
        out.excerpt = excerpt
      }
      if (fields.content !== undefined) out.content = ctx.sanitizeHtml(String(fields.content)).slice(0, 100000)
      if (fields.category !== undefined) out.category = String(fields.category).slice(0, 60) || null
      if (fields.tags !== undefined) {
        const raw = Array.isArray(fields.tags) ? fields.tags : String(fields.tags).split(',')
        const tags = raw.map((t) => String(t).trim()).filter(Boolean)
        if (tags.length > 5 || tags.some((t) => t.length > 12)) return { error: '5 mots-clés maximum, 12 caractères chacun' }
        out.tags = tags
      }
      if (file) {
        const ext = IMAGE_TYPES[file.contentType]
        if (!ext) return { error: 'Image : formats acceptés JPEG, PNG, WebP, GIF' }
        if (file.content.length > MAX_IMAGE) return { error: 'Image : 5 Mo maximum' }
        out._image = { ext, content: file.content, contentType: file.contentType }
      }
      return { out }
    }
    const uploadImage = async (postId, image) => {
      const filePath = `posts/${postId}/${Date.now()}.${image.ext}`
      const { error } = await supabaseAdmin.storage.from('blogs').upload(filePath, image.content, { contentType: image.contentType, upsert: true })
      if (error) return { error: error.message }
      return { url: supabaseAdmin.storage.from('blogs').getPublicUrl(filePath).data.publicUrl }
    }

    if (method === 'GET' && s1 === 'published' && !s2) return listPosts((q) => q.eq('published', true).eq('archived', false))
    if (method === 'GET' && s1 === 'archived' && !s2) {
      const admin = await authenticateAdmin(); if (!admin) return true
      return listPosts((q) => q.eq('archived', true))
    }
    if (method === 'GET' && !s1) {
      const admin = await authenticateAdmin(); if (!admin) return true
      return listPosts((q) => q)
    }
    if (method === 'GET' && s1 && UUID_RE.test(s1) && !s2) {
      const { data: post, error } = await supabaseAdmin.from('blog_posts').select('*').eq('id', s1).maybeSingle()
      if (error) return dbError(error)
      const viewer = await checkAuth(req)
      const isAdmin = !viewer.error && viewer.role === 'admin'
      if (!post || ((!post.published || post.archived) && !isAdmin)) return send(404, { error: 'Article introuvable' })
      if (post.published && !post.archived) {
        post.views = (post.views ?? 0) + 1
        await supabaseAdmin.from('blog_posts').update({ views: post.views }).eq('id', s1)
      }
      const { data: rows } = await supabaseAdmin.from('blog_comments').select('id, user_id, content, created_at').eq('post_id', s1).order('created_at', { ascending: true }).limit(500)
      const comments = (rows || []).map((c) => ({ ...c, _id: c.id, authorId: c.user_id }))
      return send(200, { success: true, data: postShape(post, comments) })
    }
    if (method === 'POST' && !s1) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { out, error: invalid } = await readPostForm()
      if (invalid) return send(400, { error: invalid })
      if (!out.title || !out.excerpt || !out.content) return send(400, { error: 'title, excerpt et content sont obligatoires' })
      const { _image, ...fields } = out
      const { data, error } = await supabaseAdmin.from('blog_posts')
        .insert({ ...fields, user_id: admin.userId, published: true, archived: false, published_at: new Date().toISOString() }).select().single()
      if (error) return dbError(error)
      let post = data
      if (_image) {
        const uploaded = await uploadImage(post.id, _image)
        if (uploaded.error) {
          await supabaseAdmin.from('blog_posts').delete().eq('id', post.id)
          return send(500, { error: `Téléversement de l’image impossible : ${uploaded.error}` })
        }
        const { data: withImage } = await supabaseAdmin.from('blog_posts').update({ image: uploaded.url }).eq('id', post.id).select().single()
        post = withImage || post
      }
      return send(201, { success: true, data: postShape(post) })
    }
    if (method === 'PUT' && s1 && UUID_RE.test(s1) && !s2) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { out, error: invalid } = await readPostForm()
      if (invalid) return send(400, { error: invalid })
      const { _image, ...fields } = out
      if (_image) {
        const uploaded = await uploadImage(s1, _image)
        if (uploaded.error) return send(500, { error: `Téléversement de l’image impossible : ${uploaded.error}` })
        fields.image = uploaded.url
      }
      if (!Object.keys(fields).length) return send(400, { error: 'Nothing to update' })
      const { data, error } = await supabaseAdmin.from('blog_posts').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', s1).select().maybeSingle()
      if (error) return dbError(error)
      if (!data) return send(404, { error: 'Article introuvable' })
      return send(200, { success: true, data: postShape(data) })
    }
    // Publication / archivage : mutations, donc POST (le front envoyait un GET)
    if (['POST', 'PUT'].includes(method) && ['publish', 'archive'].includes(s1) && s2 && UUID_RE.test(s2)) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const publishing = s1 === 'publish'
      const patch = publishing
        ? { published: true, archived: false, published_at: new Date().toISOString() }
        : { published: false, archived: true }
      const { data, error } = await supabaseAdmin.from('blog_posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', s2).select().maybeSingle()
      if (error) return dbError(error)
      if (!data) return send(404, { error: 'Article introuvable' })
      return send(200, { success: true, data: postShape(data) })
    }
    if (method === 'DELETE' && s1 && UUID_RE.test(s1) && !s2) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { data, error } = await supabaseAdmin.from('blog_posts').delete().eq('id', s1).select('id')
      if (error) return dbError(error)
      if (!data?.length) return send(404, { error: 'Article introuvable' })
      return send(200, { success: true, data: { id: s1, _id: s1 } })
    }
    // Commentaires : texte brut, utilisateur connecté, article publié
    if (method === 'POST' && s1 === 'comment' && s2 && UUID_RE.test(s2)) {
      const auth = await authenticate(); if (!auth) return true
      const content = String(req.body?.content ?? req.body?.text ?? '').replace(/<[^>]*>/g, '').trim()
      if (!content) return send(400, { error: 'Le commentaire est vide' })
      if (content.length > 2000) return send(400, { error: 'Le commentaire est limité à 2000 caractères' })
      const { data: post } = await supabaseAdmin.from('blog_posts').select('id, published, archived').eq('id', s2).maybeSingle()
      if (!post || !post.published || post.archived) return send(404, { error: 'Article introuvable' })
      const { error } = await supabaseAdmin.from('blog_comments').insert({ post_id: s2, user_id: auth.userId, content })
      if (error) return dbError(error)
      const { data: full } = await supabaseAdmin.from('blog_posts').select('*').eq('id', s2).single()
      const { data: rows } = await supabaseAdmin.from('blog_comments').select('id, user_id, content, created_at').eq('post_id', s2).order('created_at', { ascending: true }).limit(500)
      const comments = (rows || []).map((c) => ({ ...c, _id: c.id, authorId: c.user_id }))
      return send(201, { success: true, data: postShape(full, comments) })
    }
    if (method === 'DELETE' && s1 === 'comment' && s2 && UUID_RE.test(s2)) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { data, error } = await supabaseAdmin.from('blog_comments').delete().eq('id', s2).select('id')
      if (error) return dbError(error)
      if (!data?.length) return send(404, { error: 'Commentaire introuvable' })
      return send(200, { success: true })
    }
    return false
  }

  // ─── Auth : mot de passe et gestion des utilisateurs ──────────────────────
  if (s0 === 'auth') {
    // Réinitialisation après le lien e-mail : session de récupération requise
    if (method === 'POST' && s1 === 'reset-password') {
      const auth = await authenticate(); if (!auth) return true
      const password = req.body?.password
      if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
        return send(400, { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères` })
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(auth.userId, { password })
      if (error) return send(400, { error: error.message })
      return send(200, { success: true })
    }
    // Changement avec vérification de l'ancien mot de passe côté serveur
    if (method === 'POST' && s1 === 'change-password') {
      const auth = await authenticate(); if (!auth) return true
      const { oldPassword, newPassword } = req.body || {}
      if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') return send(400, { error: 'oldPassword et newPassword requis' })
      if (newPassword.length < MIN_PASSWORD) return send(400, { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères` })
      if (newPassword === oldPassword) return send(400, { error: 'Le nouveau mot de passe doit être différent de l’ancien' })
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      if (!anonKey) return send(500, { error: 'SUPABASE_ANON_KEY manquante côté serveur : vérification de l’ancien mot de passe impossible' })
      const verifier = createClient(process.env.SUPABASE_URL, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error: signInError } = await verifier.auth.signInWithPassword({ email: auth.user.email, password: oldPassword })
      if (signInError) return send(403, { error: 'Ancien mot de passe incorrect' })
      const { error } = await supabaseAdmin.auth.admin.updateUserById(auth.userId, { password: newPassword })
      if (error) return send(400, { error: error.message })
      return send(200, { success: true, data: { id: auth.userId, _id: auth.userId, email: auth.user.email } })
    }
    if (method === 'POST' && s1 === 'logout') {
      const token = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
      if (token) { try { await supabaseAdmin.auth.admin.signOut(token) } catch { /* déjà déconnecté */ } }
      return send(200, { success: true })
    }
    if (method === 'GET' && s1 === 'export') return send(501, { error: 'Export Excel non disponible : utiliser l’export CSV' })

    // Création d'un utilisateur par l'admin
    if (method === 'POST' && !s1) {
      const admin = await authenticateAdmin(); if (!admin) return true
      const { email, password, name, role = 'buyer' } = req.body || {}
      const ROLES = ['buyer', 'artist', 'curator', 'advisor', 'admin']
      if (!EMAIL_RE.test(String(email || ''))) return send(400, { error: 'E-mail invalide' })
      if (typeof password !== 'string' || password.length < MIN_PASSWORD) return send(400, { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères` })
      if (!ROLES.includes(role)) return send(400, { error: `Rôle invalide. Valeurs : ${ROLES.join(', ')}` })
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: String(email).toLowerCase(), password, email_confirm: true, user_metadata: { name: name || '', role },
      })
      if (error || !created?.user) return send(400, { error: error?.message || 'Création impossible' })
      // La ligne users est créée par le trigger on_auth_user_created ; on fixe rôle et nom
      const { data: row, error: rowError } = await supabaseAdmin
        .from('users').update({ role, name: name || null, is_active: true }).eq('id', created.user.id).select('id, name, role, is_active').maybeSingle()
      if (rowError) return dbError(rowError)
      return send(201, { success: true, data: { id: created.user.id, _id: created.user.id, email: created.user.email, ...(row || { role, name }) } })
    }
    if (s1 && UUID_RE.test(s1) && !s2) {
      if (method === 'GET') {
        const auth = await authenticate(); if (!auth) return true
        if (auth.role !== 'admin' && auth.userId !== s1) return send(403, { error: 'You can only view your own account' })
        const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', s1).maybeSingle()
        if (error) return dbError(error)
        if (!data) return send(404, { error: 'User not found' })
        return send(200, { success: true, data: { ...data, _id: data.id } })
      }
      if (method === 'DELETE') {
        const admin = await authenticateAdmin(); if (!admin) return true
        if (s1 === admin.userId) return send(400, { error: 'Vous ne pouvez pas supprimer votre propre compte' })
        const { data: target } = await supabaseAdmin.from('users').select('id').eq('id', s1).maybeSingle()
        if (!target) return send(404, { error: 'User not found' })
        const { error } = await supabaseAdmin.auth.admin.deleteUser(s1)
        if (error) return send(400, { error: error.message })
        return send(200, { success: true, data: { id: s1, _id: s1 } })
      }
    }
    // Activation / désactivation (bascule) par l'admin ; bloque aussi la connexion côté Supabase Auth
    if (s1 === 'status' && s2 && UUID_RE.test(s2) && ['POST'].includes(method)) {
      const admin = await authenticateAdmin(); if (!admin) return true
      if (s2 === admin.userId) return send(400, { error: 'Vous ne pouvez pas désactiver votre propre compte' })
      const { data: target } = await supabaseAdmin.from('users').select('id, is_active').eq('id', s2).maybeSingle()
      if (!target) return send(404, { error: 'User not found' })
      const nextActive = target.is_active === false
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(s2, { ban_duration: nextActive ? 'none' : '876000h' })
      if (banError) return send(400, { error: banError.message })
      const { data, error } = await supabaseAdmin.from('users').update({ is_active: nextActive }).eq('id', s2).select('id, name, role, is_active').single()
      if (error) return dbError(error)
      return send(200, { success: true, data: { ...data, _id: data.id } })
    }
    return false
  }

  return false
}
