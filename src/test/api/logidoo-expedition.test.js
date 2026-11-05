// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi } from './helpers'
import { buildExpeditionPayload, mapLogidooStatus, normalizeTransport } from '../../../api/_modules/logidoo-expedition.js'
import { COUNTRY_CODES, isCountryCode, logidooCountryName, listCountries } from '../../../api/_modules/countries.js'

/** Logidoo simulé : garde les expéditions en mémoire, aucun appel réseau réel. */
const fakeLogidoo = () => {
  const state = { expeditions: {}, calls: [], failCreate: null, failCancel: null, seq: 0 }
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    const path = new URL(String(url)).pathname.replace('/api/v1', '')
    state.calls.push({ method, path, body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization })
    const reply = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) })
    if (method === 'POST' && path === '/expedition') {
      if (state.failCreate) return reply(state.failCreate, { message: 'refusé' })
      const n = ++state.seq
      const doc = {
        _id: `exp${n}`,
        costing: { totalCost: 319660, currency: 'XOF' },
        tracking: { trackingNumber: `05249890012${n}`, trackingUrl: `https://staging.logidoo.co/expedition-tracking/05249890012${n}`, status: 'PENDING' },
      }
      state.expeditions[doc._id] = doc
      return reply(200, doc)
    }
    const one = path.match(/^\/expedition\/(\w+)$/)
    if (one && method === 'GET') return state.expeditions[one[1]] ? reply(200, state.expeditions[one[1]]) : reply(404, {})
    if (one && method === 'DELETE') {
      if (state.failCancel) return reply(state.failCancel, {})
      delete state.expeditions[one[1]]
      return reply(200, {})
    }
    return reply(404, {})
  }))
  return state
}

describe('Pays et options de transport', () => {
  it('liste tous les pays du monde ; Côte d’Ivoire = « Ivory Cost » chez Logidoo', () => {
    expect(COUNTRY_CODES.length).toBe(249)
    for (const code of ['SN', 'CI', 'ML', 'GA', 'FR', 'BE', 'JP', 'BR']) expect(isCountryCode(code)).toBe(true)
    expect(isCountryCode('XX')).toBe(false)
    expect(logidooCountryName('CI')).toBe('Ivory Cost')
    expect(listCountries('fr').find((c) => c.code === 'CI').name).toMatch(/Ivoire/)
  })

  it('aérien + express par défaut, autres options acceptées, valeurs inconnues refusées', () => {
    expect(normalizeTransport({})).toEqual({ mode: 'AIR', type: 'EXPRESS' })
    expect(normalizeTransport({ transportMode: 'sea', transportType: 'groupage' })).toEqual({ mode: 'SEA', type: 'GROUPAGE' })
    expect(normalizeTransport({ transportMode: 'ROCKET' }).error).toMatch(/transportMode/)
    expect(normalizeTransport({ transportType: 'X' }).error).toMatch(/transportType/)
  })

  it('traduit les statuts Logidoo', () => {
    expect(mapLogidooStatus('VALIDATED')).toBe('pending')
    expect(mapLogidooStatus('picked_up')).toBe('picked_up')
    expect(mapLogidooStatus('CUSTOMS_IMPORT')).toBe('customs')
    expect(mapLogidooStatus('DELIVERY_IN_PROGRESS')).toBe('in_transit')
    expect(mapLogidooStatus('DELIVERED')).toBe('delivered')
    expect(mapLogidooStatus('???')).toBeNull()
  })
})

describe('Corps du POST /expedition', () => {
  const delivery = {
    sender_name: 'Awa', sender_email: 'awa@test.local', sender_phone: '+221700', sender_address: 'Dakar',
    recipient_name: 'Luc', recipient_phone: '+33600', delivery_address: '1 rue X, Paris',
    origin_country_code: 'SN', destination_country_code: 'FR', package_weight: 4.2,
  }
  it('arrondit le poids au kg supérieur, Sénégal par défaut, AIR/EXPRESS', () => {
    const { payload, missing } = buildExpeditionPayload(delivery, [{ title: 'Masque', price: 150000.4, weight: 2 }])
    expect(missing).toEqual([])
    expect(payload).toMatchObject({
      managingCountry: 'Senegal', transportMode: 'AIR', transportType: 'EXPRESS', totalWeight: 5,
      pickUpLocationCountryCode: 'SN', dropOffLocationCountryCode: 'FR',
      packages: [{ goodsName: 'Masque', quantity: 1, weight: 5, unitPrice: 150000 }],
    })
  })
  it('liste les champs manquants au lieu d’envoyer un corps incomplet', () => {
    const { missing } = buildExpeditionPayload({ recipient_name: 'Luc' }, [])
    expect(missing).toEqual(expect.arrayContaining(["e-mail de l'expéditeur", "adresse de l'expéditeur", 'pays de départ', "pays d'arrivée", 'poids du colis']))
  })
})

describe('Validation admin → création chez Logidoo (simulée)', () => {
  let db, call, logidoo, admin, artist, buyer, deliveryId
  const body = (over = {}) => ({
    corridor: 'AF_TO_FR', originCountry: 'Sénégal', originCountryCode: 'SN', destinationCountry: 'France', destinationCountryCode: 'FR',
    deliveryAddress: '1 rue X, Paris', recipientName: 'Luc', recipientPhone: '+33600000000', recipientEmail: 'luc@test.local',
    senderPhone: '+221700000000', senderAddress: 'Almadies, Dakar', packageWeight: 3.2, goodsValue: 500000,
    ...over,
  })
  const create = async (token, over) => (await call({ method: 'POST', url: '/api/delivery', token, body: body(over) }))
  const validate = (id = deliveryId, token = admin.token) => call({ method: 'POST', url: `/api/logistics/expeditions/${id}/validate`, token })

  beforeEach(async () => {
    process.env.LOGIDOO_API_KEY = 'tok_test'
    process.env.LOGIDOO_ENV = 'staging'
    ;({ db, call } = await loadApi())
    logidoo = fakeLogidoo()
    admin = db.addUser({ role: 'admin', email: 'admin@test.local' })
    artist = db.addUser({ role: 'artist', email: 'artist@test.local', name: 'Awa Diop' })
    buyer = db.addUser({ role: 'buyer', email: 'buyer@test.local' })
    const res = await create(artist.token)
    expect(res.statusCode).toBe(201)
    deliveryId = res.body.data.id
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.LOGIDOO_API_KEY
    delete process.env.LOGIDOO_ENV
  })

  it('la demande reste en attente : aucun appel Logidoo avant la validation admin', () => {
    const row = db.tables.delivery_requests[0]
    expect(row).toMatchObject({ status: 'pending', transport_mode: 'AIR', transport_type: 'EXPRESS', destination_country_code: 'FR', sender_email: 'artist@test.local' })
    expect(logidoo.calls).toHaveLength(0)
  })

  it('le collectionneur peut aussi faire une demande ; un visiteur non', async () => {
    expect((await create(buyer.token)).statusCode).toBe(201)
    expect((await call({ method: 'POST', url: '/api/delivery', body: body() })).statusCode).toBe(401)
  })

  it('refuse un pays ou un mode de transport invalide', async () => {
    expect((await create(artist.token, { destinationCountryCode: 'ZZ' })).statusCode).toBe(400)
    expect((await create(artist.token, { transportMode: 'ROCKET' })).statusCode).toBe(400)
    expect((await create(artist.token, { transportMode: 'SEA', transportType: 'GROUPAGE', destinationCountryCode: 'JP' })).statusCode).toBe(201)
  })

  it('le formulaire de cotation (POST /logistics/expeditions) fournit tout ce qu’exige Logidoo', async () => {
    const created = await call({ method: 'POST', url: '/api/logistics/expeditions', token: artist.token, body: {
      recipient: { name: 'Luc', phone: '+33600000000', address: '1 rue X, Paris' },
      package: { weight: 2.5, size: 'small' }, zone: 'France', destination_country_code: 'fr',
      origin_country_code: 'SN', sender_phone: '+221700000000', sender_address: 'Almadies, Dakar',
    } })
    expect(created.statusCode).toBe(201)
    expect(db.tables.delivery_requests.at(-1)).toMatchObject({ destination_country_code: 'FR', origin_country_code: 'SN', transport_mode: 'AIR', transport_type: 'EXPRESS', sender_phone: '+221700000000' })
    expect((await validate(created.body.expedition.id)).statusCode).toBe(200)
    expect(logidoo.calls.find((c) => c.method === 'POST').body).toMatchObject({ totalWeight: 3, pickUpLocationCountryCode: 'SN', dropOffLocationCountryCode: 'FR' })
    expect((await call({ method: 'POST', url: '/api/logistics/expeditions', token: artist.token, body: { recipient: { name: 'L', phone: '1' }, transportMode: 'ROCKET' } })).statusCode).toBe(400)
  })

  it('seul un admin peut valider', async () => {
    expect((await validate(deliveryId, artist.token)).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: `/api/logistics/expeditions/${deliveryId}/validate` })).statusCode).toBe(401)
    expect(logidoo.calls).toHaveLength(0)
  })

  it('crée l’expédition, enregistre coût et suivi, prévient le demandeur', async () => {
    const res = await validate()
    expect(res.statusCode).toBe(200)
    const sent = logidoo.calls.find((c) => c.method === 'POST')
    expect(sent.auth).toBe('Bearer tok_test')
    expect(sent.body).toMatchObject({ senderName: 'Awa Diop', senderEmail: 'artist@test.local', managingCountry: 'Senegal', transportMode: 'AIR', transportType: 'EXPRESS', totalWeight: 4, dropOffLocationCountryCode: 'FR' })
    const row = db.tables.delivery_requests[0]
    expect(row).toMatchObject({ logidoo_expedition_id: 'exp1', logidoo_status: 'PENDING', price: 319660, currency: 'XOF', status: 'pending', validated_by: admin.id })
    expect(row.logidoo_tracking_number).toMatch(/^05249890012/)
    expect(row.logidoo_tracking_url).toMatch(/expedition-tracking/)
    const notif = db.tables.notifications.find((n) => n.user_id === artist.id)
    expect(notif.title).toBe('Expédition validée')
    expect(notif.message).toMatch(/319660 XOF/)
  })

  it('ne crée jamais deux expéditions pour la même demande', async () => {
    expect((await validate()).statusCode).toBe(200)
    expect((await validate()).statusCode).toBe(409)
    expect(logidoo.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('informations manquantes : 400 sans appel Logidoo', async () => {
    Object.assign(db.tables.delivery_requests[0], { sender_address: null, destination_country_code: null })
    const res = await validate()
    expect(res.statusCode).toBe(400)
    expect(res.body.missing).toEqual(expect.arrayContaining(["adresse de l'expéditeur", "pays d'arrivée"]))
    expect(logidoo.calls).toHaveLength(0)
  })

  it('erreur Logidoo : rien n’est enregistré comme créé, l’admin peut réessayer', async () => {
    logidoo.failCreate = 400
    const res = await validate()
    expect(res.statusCode).toBe(502)
    expect(db.tables.delivery_requests[0]).toMatchObject({ logidoo_submitted_at: null })
    expect(db.tables.delivery_requests[0].logidoo_expedition_id).toBeFalsy()
    expect(db.tables.delivery_requests[0].logidoo_error).toBeTruthy()
    expect(db.tables.notifications || []).toHaveLength(0)
    logidoo.failCreate = null
    expect((await validate()).statusCode).toBe(200)
  })

  it('jeton Logidoo absent : 503 explicite', async () => {
    delete process.env.LOGIDOO_API_KEY
    const res = await validate()
    expect(res.statusCode).toBe(503)
  })

  it('suit les statuts Logidoo, notifie à chaque changement, s’arrête à la livraison', async () => {
    await validate()
    db.tables.notifications.length = 0
    logidoo.expeditions.exp1.tracking.status = 'IN_TRANSIT'
    let sync = await call({ method: 'POST', url: '/api/logistics/sync-statuses', token: admin.token })
    expect(sync.body).toMatchObject({ success: true, checked: 1, updated: 1 })
    expect(db.tables.delivery_requests[0]).toMatchObject({ status: 'in_transit', logidoo_status: 'IN_TRANSIT' })
    expect(db.tables.notifications).toHaveLength(1)

    sync = await call({ method: 'POST', url: '/api/logistics/sync-statuses', token: admin.token })
    expect(sync.body.updated).toBe(0) // rien de neuf : pas de notification en double

    logidoo.expeditions.exp1.tracking.status = 'DELIVERED'
    await call({ method: 'POST', url: '/api/logistics/sync-statuses', token: admin.token })
    expect(db.tables.delivery_requests[0].status).toBe('delivered')
    expect(db.tables.notifications.at(-1).title).toBe('Colis livré')
    sync = await call({ method: 'POST', url: '/api/logistics/sync-statuses', token: admin.token })
    expect(sync.body.checked).toBe(0)
    expect((await call({ method: 'POST', url: '/api/logistics/sync-statuses', token: artist.token })).statusCode).toBe(403)
  })

  it('annulation : annulée chez Logidoo d’abord ; si Logidoo refuse, la demande reste active', async () => {
    await validate()
    const tid = db.tables.delivery_requests[0].tracking_id
    logidoo.failCancel = 500
    const refused = await call({ method: 'DELETE', url: `/api/logistics/cancel/${tid}`, token: artist.token })
    expect(refused.statusCode).toBe(502)
    expect(db.tables.delivery_requests[0].status).toBe('pending')
    logidoo.failCancel = null
    expect((await call({ method: 'DELETE', url: `/api/logistics/cancel/${tid}`, token: artist.token })).statusCode).toBe(200)
    expect(db.tables.delivery_requests[0].status).toBe('cancelled')
    expect(logidoo.expeditions.exp1).toBeUndefined()
  })
})
