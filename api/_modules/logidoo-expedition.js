/**
 * api/_modules/logidoo-expedition.js — Création des expéditions chez Logidoo après validation admin,
 * suivi des statuts et annulation.
 *
 * Flux : la demande est créée « pending » par l'artiste / curateur / conseiller / collectionneur →
 * un administrateur la valide → POST /expedition chez Logidoo → coût (costing.totalCost), numéro et lien de
 * suivi enregistrés → le demandeur est notifié.
 *
 * Contrat (documentation Logidoo) : réponse de création = { _id, costing:{ totalCost, currency },
 * tracking:{ trackingNumber, trackingUrl, status }, … } ; statuts : PENDING, VALIDATED, PICKUP_IN_PROGRESS,
 * PICKED_UP, ARRIVED_AT_SORTING_CENTER, IN_AGENCY, ASSIGNED_TO_CARRIER, IN_TRANSIT, DELIVERY_IN_PROGRESS,
 * CUSTOMS_EXPORT, CUSTOMS_IMPORT, DELIVERED.
 */

import { isCountryCode } from './countries.js'

export const TRANSPORT_MODES = ['AIR', 'SEA', 'LAND']
export const TRANSPORT_TYPES = ['EXPRESS', 'FRET', 'GROUPAGE']
export const DEFAULT_TRANSPORT = { mode: 'AIR', type: 'EXPRESS' }
// KUCIBOK est géré depuis le Sénégal (valeur par défaut de l'API Logidoo)
export const MANAGING_COUNTRY = 'Senegal'

const STATUS_MAP = {
  PENDING: 'pending',
  VALIDATED: 'pending',
  PICKUP_IN_PROGRESS: 'picked_up',
  PICKED_UP: 'picked_up',
  ARRIVED_AT_SORTING_CENTER: 'in_transit',
  IN_AGENCY: 'in_transit',
  ASSIGNED_TO_CARRIER: 'in_transit',
  IN_TRANSIT: 'in_transit',
  DELIVERY_IN_PROGRESS: 'in_transit',
  CUSTOMS_EXPORT: 'customs',
  CUSTOMS_IMPORT: 'customs',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  CANCELED: 'cancelled',
  FAILED: 'failed',
  RETURNED: 'exception',
}
const FINAL = ['delivered', 'cancelled', 'failed']

const STATUS_LABEL = {
  pending: 'en attente de prise en charge',
  picked_up: 'colis récupéré',
  in_transit: 'en transit',
  customs: 'en douane',
  delivered: 'livré',
  cancelled: 'annulé',
  failed: 'en échec',
  exception: 'incident de livraison',
}

export const mapLogidooStatus = (status) => STATUS_MAP[String(status || '').trim().toUpperCase()] || null

const text = (v) => (v === null || v === undefined ? '' : String(v).trim())
const num = (v) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : null)

/** Contrôle et normalise les options de transport reçues du formulaire. */
export function normalizeTransport({ transportMode, transportType } = {}) {
  const mode = text(transportMode).toUpperCase() || DEFAULT_TRANSPORT.mode
  const type = text(transportType).toUpperCase() || DEFAULT_TRANSPORT.type
  if (!TRANSPORT_MODES.includes(mode)) return { error: `transportMode doit valoir : ${TRANSPORT_MODES.join(', ')}` }
  if (!TRANSPORT_TYPES.includes(type)) return { error: `transportType doit valoir : ${TRANSPORT_TYPES.join(', ')}` }
  return { mode, type }
}

/**
 * Construit le corps du POST /expedition à partir de la demande. Renvoie aussi la liste des champs
 * obligatoires manquants (en français) : rien n'est envoyé à Logidoo tant qu'elle n'est pas vide.
 */
export function buildExpeditionPayload(delivery, artworks = [], sender = {}) {
  const missing = []
  const need = (value, label) => { if (!text(value)) missing.push(label); return text(value) }

  const senderName = need(delivery.sender_name || sender.name, "nom de l'expéditeur")
  const senderEmail = need(delivery.sender_email || sender.email, "e-mail de l'expéditeur")
  const senderPhone = need(delivery.sender_phone || sender.telephone, "téléphone de l'expéditeur")
  const senderAddress = need(delivery.sender_address, "adresse de l'expéditeur")
  const recipientName = need(delivery.recipient_name, 'nom du destinataire')
  const recipientPhone = need(delivery.recipient_phone, 'téléphone du destinataire')
  const recipientAddress = need(delivery.delivery_address, 'adresse du destinataire')

  const from = text(delivery.origin_country_code).toUpperCase()
  const to = text(delivery.destination_country_code).toUpperCase()
  if (!isCountryCode(from)) missing.push('pays de départ')
  if (!isCountryCode(to)) missing.push("pays d'arrivée")

  const transport = normalizeTransport({ transportMode: delivery.transport_mode, transportType: delivery.transport_type })
  if (transport.error) missing.push('mode de transport')

  // Colis : une ligne par œuvre ; à défaut, une ligne générique
  const declaredWeight = num(delivery.package_weight)
  const share = declaredWeight && artworks.length ? declaredWeight / artworks.length : null
  const packages = artworks.length
    ? artworks.map((a) => ({
        goodsName: text(a.title) || "Œuvre d'art",
        quantity: 1,
        weight: Math.max(1, Math.ceil(share ?? num(a.weight) ?? 1)),
        unitPrice: Math.round(num(a.price) ?? 0),
      }))
    : [{
        goodsName: "Œuvre d'art",
        quantity: 1,
        weight: Math.max(1, Math.ceil(declaredWeight ?? 1)),
        unitPrice: Math.round(num(delivery.goods_value) ?? 0),
      }]
  if (!declaredWeight && !artworks.some((a) => num(a.weight))) missing.push('poids du colis')
  const totalWeight = Math.max(1, Math.ceil(declaredWeight ?? packages.reduce((sum, p) => sum + p.weight * p.quantity, 0)))

  const payload = {
    senderName, senderPhone, senderEmail, senderAddress,
    recipientName, recipientPhone, recipientAddress,
    ...(text(delivery.recipient_email) ? { recipientEmail: text(delivery.recipient_email) } : {}),
    packages,
    totalWeight,
    managingCountry: MANAGING_COUNTRY,
    pickUpLocationCountryCode: from,
    dropOffLocationCountryCode: to,
    pickUpLocationName: text(delivery.pickup_node_name) || senderAddress,
    dropOffLocationName: text(delivery.dropoff_node_name) || recipientAddress,
    ...(text(delivery.pickup_node_id) ? { pickUpLocationId: text(delivery.pickup_node_id) } : {}),
    ...(text(delivery.dropoff_node_id) ? { dropOffLocationId: text(delivery.dropoff_node_id) } : {}),
    transportMode: transport.mode,
    transportType: transport.type,
    ...(text(delivery.special_instructions) ? { pickUpInstructions: text(delivery.special_instructions), deliveryInstructions: text(delivery.special_instructions) } : {}),
    ...(delivery.collect_date ? { expectedPickUpDate: new Date(delivery.collect_date).toISOString() } : {}),
    ...(delivery.delivery_date ? { expectedDeliveryDate: new Date(delivery.delivery_date).toISOString() } : {}),
  }
  return { payload, missing }
}

const loadArtworks = async (supabaseAdmin, deliveryId) => {
  const { data: links } = await supabaseAdmin.from('delivery_artwork_ids').select('artwork_id').eq('delivery_id', deliveryId)
  const ids = (links || []).map((l) => l.artwork_id)
  if (!ids.length) return []
  const { data } = await supabaseAdmin.from('artworks').select('id, title, price, weight').in('id', ids)
  return data || []
}

/**
 * Validation admin : crée l'expédition chez Logidoo, enregistre coût et suivi, prévient le demandeur.
 * Idempotent : une demande déjà transmise n'est jamais renvoyée (pas de doublon chez le transporteur).
 * @returns {{ status:number, error?:string, missing?:string[], data?:object }}
 */
export async function validateAndCreateExpedition({ supabaseAdmin, client, notify, deliveryId, adminId }) {
  const { data: delivery, error } = await supabaseAdmin.from('delivery_requests').select('*').eq('id', deliveryId).maybeSingle()
  if (error) return { status: 500, error: error.message }
  if (!delivery) return { status: 404, error: 'Livraison introuvable' }
  if (delivery.logidoo_expedition_id) return { status: 409, error: 'Expédition déjà créée chez Logidoo', data: delivery }
  if (['cancelled', 'delivered', 'failed'].includes(delivery.status)) return { status: 409, error: `Demande déjà ${delivery.status}` }

  const { data: user } = await supabaseAdmin.from('users').select('id, name, telephone').eq('id', delivery.user_id).maybeSingle()
  const artworks = await loadArtworks(supabaseAdmin, deliveryId)
  const { payload, missing } = buildExpeditionPayload(delivery, artworks, user || {})
  if (missing.length) return { status: 400, error: `Informations manquantes : ${missing.join(', ')}`, missing }

  // Réservation : empêche deux clics simultanés de créer deux expéditions
  const { data: claimed } = await supabaseAdmin
    .from('delivery_requests')
    .update({ logidoo_submitted_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .is('logidoo_submitted_at', null)
    .select('id')
  if (!claimed?.length) return { status: 409, error: 'Création déjà en cours pour cette demande' }

  let created
  try {
    created = await client.createExpedition(payload)
  } catch (err) {
    await supabaseAdmin.from('delivery_requests').update({ logidoo_submitted_at: null, logidoo_error: String(err.message || 'Erreur Logidoo').slice(0, 500) }).eq('id', deliveryId)
    return { status: 502, error: err.message || 'Erreur Logidoo', code: err.code, httpStatus: err.status, logidooBody: err.body }
  }

  const trackingNumber = created?.tracking?.trackingNumber || null
  const expeditionId = created?._id || null
  if (!expeditionId || !trackingNumber) {
    // Réponse inattendue : on ne sait pas si l'expédition existe → on garde la réservation pour éviter un doublon
    await supabaseAdmin.from('delivery_requests').update({ logidoo_error: 'Réponse Logidoo inattendue (identifiant ou suivi absent) : vérifier dans le back-office Logidoo' }).eq('id', deliveryId)
    return { status: 502, error: 'Réponse Logidoo inattendue : vérifier dans le back-office Logidoo avant de relancer' }
  }

  const cost = num(created?.costing?.totalCost)
  const currency = text(created?.costing?.currency) || 'XOF'
  const patch = {
    logidoo_expedition_id: expeditionId,
    logidoo_tracking_number: trackingNumber,
    logidoo_tracking_url: created?.tracking?.trackingUrl || null,
    logidoo_status: created?.tracking?.status || 'PENDING',
    logidoo_error: null,
    validated_at: new Date().toISOString(),
    validated_by: adminId || null,
    ...(cost !== null ? { price: cost, currency } : {}),
  }
  const { data: updated, error: updateError } = await supabaseAdmin.from('delivery_requests').update(patch).eq('id', deliveryId).select().single()
  if (updateError) return { status: 500, error: `Expédition créée chez Logidoo (${trackingNumber}) mais non enregistrée : ${updateError.message}` }

  await supabaseAdmin.from('delivery_events').insert({
    delivery_id: deliveryId,
    status: 'pending',
    note: `Validée et transmise à Logidoo — suivi ${trackingNumber}${cost !== null ? ` — coût ${cost} ${currency}` : ''}`,
  })
  await notify(delivery.user_id, {
    type: 'delivery',
    severity: 'success',
    title: 'Expédition validée',
    message: `Votre demande ${delivery.tracking_id} est validée. Suivi Logidoo : ${trackingNumber}${cost !== null ? ` — coût : ${cost} ${currency}` : ''}.`,
    metadata: { deliveryId, trackingId: delivery.tracking_id, logidooTrackingNumber: trackingNumber, trackingUrl: patch.logidoo_tracking_url, cost, currency },
  })
  return { status: 200, data: updated }
}

/** Synchronise les statuts des expéditions Logidoo en cours ; notifie à chaque changement. */
export async function syncLogidooStatuses({ supabaseAdmin, client, notify, limit = 25 }) {
  const { data: rows, error } = await supabaseAdmin
    .from('delivery_requests')
    .select('id, user_id, tracking_id, status, logidoo_expedition_id, logidoo_status')
    .not('logidoo_expedition_id', 'is', null)
    .limit(200)
  if (error) return { status: 500, error: error.message }
  const active = (rows || []).filter((r) => !FINAL.includes(r.status)).slice(0, limit)
  const result = { checked: 0, updated: 0, failed: 0, unknown: [] }
  // Séquentiel et borné : la fonction Vercel est limitée à 10 s
  for (const row of active) {
    result.checked += 1
    try {
      const expedition = await client.getExpedition(row.logidoo_expedition_id)
      const remote = text(expedition?.tracking?.status).toUpperCase()
      if (!remote || remote === text(row.logidoo_status).toUpperCase()) continue
      const internal = mapLogidooStatus(remote)
      if (!internal) result.unknown.push(remote)
      const patch = { logidoo_status: remote, ...(internal ? { status: internal } : {}) }
      await supabaseAdmin.from('delivery_requests').update(patch).eq('id', row.id)
      await supabaseAdmin.from('delivery_events').insert({ delivery_id: row.id, status: internal || row.status, note: `Logidoo : ${remote}` })
      result.updated += 1
      if (internal && internal !== row.status) {
        await notify(row.user_id, {
          type: 'delivery',
          severity: internal === 'delivered' ? 'success' : ['failed', 'exception', 'cancelled'].includes(internal) ? 'warning' : 'info',
          title: internal === 'delivered' ? 'Colis livré' : 'Suivi de votre expédition',
          message: `Expédition ${row.tracking_id} : ${STATUS_LABEL[internal] || internal}.`,
          metadata: { deliveryId: row.id, trackingId: row.tracking_id, status: internal },
        })
      }
    } catch {
      result.failed += 1
    }
  }
  return { status: 200, ...result }
}

/** Annule l'expédition chez Logidoo (si elle existe). Une erreur Logidoo bloque l'annulation locale. */
export async function cancelAtLogidoo({ client, delivery }) {
  if (!delivery?.logidoo_expedition_id) return { ok: true, skipped: true }
  try {
    await client.cancelExpedition(delivery.logidoo_expedition_id)
    return { ok: true }
  } catch (err) {
    if (err?.code === 'NOT_FOUND') return { ok: true, alreadyGone: true }
    return { ok: false, error: err?.message || 'Annulation Logidoo impossible', code: err?.code }
  }
}
