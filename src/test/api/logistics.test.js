// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFakeDb, makeReq, makeRes } from './fakeSupabase'

const db = createFakeDb()

vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client }))

process.env.SUPABASE_URL = 'http://fake'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
process.env.API_KEY = 'test-key'

const { default: handler } = await import('../../../api/[...path].js')

const call = async (opts) => {
  const res = makeRes()
  await handler(makeReq(opts), res)
  return res
}

describe('/api/logistics', () => {
  let admin, artist
  beforeEach(() => {
    for (const k of Object.keys(db.tables)) delete db.tables[k]
    db.failTables.clear()
    admin = db.addUser({ role: 'admin', email: 'admin@test.local' })
    artist = db.addUser({ role: 'artist', email: 'artist@test.local' })
  })

  it('refuse sans authentification (401) et aux non-admins (403)', async () => {
    expect((await call({ url: '/api/logistics/alerts' })).statusCode).toBe(401)
    expect((await call({ url: '/api/logistics/alerts', token: artist.token })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/logistics/sync', token: artist.token })).statusCode).toBe(403)
  })

  it('liste vide puis sync -> alertes -> stats -> lecture', async () => {
    const empty = await call({ url: '/api/logistics/alerts?limit=20', token: admin.token })
    expect(empty.statusCode).toBe(200)
    expect(empty.body).toEqual({ success: true, alerts: [] })

    db.tables.delivery_requests = [
      { id: 'd1', tracking_id: 'KCB-TRK-1', status: 'in_transit', delivery_date: '2020-01-01T00:00:00Z' },
      { id: 'd2', tracking_id: 'KCB-TRK-2', status: 'delivered', delivery_date: '2020-01-01T00:00:00Z' },
    ]
    db.tables.delivery_events = [
      { id: 'e1', delivery_id: 'd1', status: 'in_transit', note: 'Départ Dakar', date: new Date().toISOString() },
      { id: 'e2', delivery_id: 'd2', status: 'delivered', note: '', date: new Date().toISOString() },
    ]
    // le faux client ne gère pas les jointures : on les simule
    for (const e of db.tables.delivery_events) {
      e.delivery_requests = { tracking_id: db.tables.delivery_requests.find((d) => d.id === e.delivery_id).tracking_id }
    }

    const sync = await call({ method: 'POST', url: '/api/logistics/sync', token: admin.token })
    expect(sync.statusCode).toBe(200)
    expect(sync.body.created).toBe(3) // 2 événements + 1 retard (d1 seulement)

    const again = await call({ method: 'POST', url: '/api/logistics/sync', token: admin.token })
    expect(again.body.created).toBe(0) // idempotent

    const list = await call({ url: '/api/logistics/alerts', token: admin.token })
    expect(list.body.alerts).toHaveLength(3)
    expect(list.body.alerts.map((a) => a.type).sort()).toEqual(['delay', 'delivered', 'status_change'])
    expect(list.body.alerts.every((a) => 'trackingId' in a && !('tracking_id' in a))).toBe(true)

    const stats = await call({ url: '/api/logistics/alerts/stats', token: admin.token })
    expect(stats.body.stats).toMatchObject({ total: 3, unread: 3, last24h: 3 })
    expect(stats.body.stats.bySeverity).toMatchObject({ info: 1, success: 1, warning: 1 })

    const id = list.body.alerts[0].id
    const one = await call({ method: 'PATCH', url: `/api/logistics/alerts/${id}/read`, token: admin.token })
    expect(one.statusCode).toBe(200)
    expect((await call({ url: '/api/logistics/alerts/stats', token: admin.token })).body.stats.unread).toBe(2)

    await call({ method: 'PATCH', url: '/api/logistics/alerts/read-all', token: admin.token })
    expect((await call({ url: '/api/logistics/alerts/stats', token: admin.token })).body.stats.unread).toBe(0)
  })

  it('valide les identifiants et renvoie 404 pour une alerte inconnue', async () => {
    expect((await call({ method: 'PATCH', url: '/api/logistics/alerts/pas-un-uuid/read', token: admin.token })).statusCode).toBe(400)
    const unknown = '00000000-0000-4000-8000-ffffffffffff'
    expect((await call({ method: 'PATCH', url: `/api/logistics/alerts/${unknown}/read`, token: admin.token })).statusCode).toBe(404)
  })

  it('signale la migration manquante au lieu d\'un faux "tout est en ordre"', async () => {
    db.failTables.add('logistics_alerts')
    const res = await call({ url: '/api/logistics/alerts', token: admin.token })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toMatch(/034_logistics_alerts/)
  })

  describe('expéditions et suivi', () => {
    let curator
    const expedition = (over = {}) => ({
      recipient: { name: 'Awa Diop', phone: '+221770000000', address: '12 rue de Dakar' },
      package: { weight: 5, size: 'medium' },
      serviceType: 'STANDARD',
      collectionDate: '2026-11-10',
      deliveryDate: '2026-11-20',
      ...over,
    })
    beforeEach(() => {
      curator = db.addUser({ role: 'curator', email: 'curator@test.local' })
      db.tables.subscriptions = [{ id: 's1', user_id: curator.id, status: 'trial', end_date: new Date(Date.now() + 864e5).toISOString() }]
    })

    it('crée une expédition avec numéro de suivi, suivi public sans données personnelles', async () => {
      const created = await call({ method: 'POST', url: '/api/logistics/expeditions', token: curator.token, body: expedition() })
      expect(created.statusCode).toBe(201)
      const tid = created.body.expedition.trackingNumber
      expect(tid).toMatch(/^KCB-TRK-[0-9A-F]{8}$/)

      const track = await call({ url: `/api/logistics/track/${tid.toLowerCase()}` }) // sans token
      expect(track.statusCode).toBe(200)
      expect(track.body.tracking).toMatchObject({ trackingId: tid, status: 'pending' })
      expect(track.body.tracking.events).toHaveLength(1)
      expect(JSON.stringify(track.body)).not.toMatch(/Awa|Dakar|770000000/)

      expect((await call({ url: `/api/delivery/track/${tid}` })).body.data.trackingId).toBe(tid)
      expect((await call({ url: '/api/logistics/track/KCB-TRK-INCONNU' })).statusCode).toBe(404)
    })

    it('valide le destinataire et la propriété des œuvres', async () => {
      expect((await call({ method: 'POST', url: '/api/logistics/expeditions', token: curator.token, body: expedition({ recipient: {} }) })).statusCode).toBe(400)
      db.tables.artworks = [{ id: 'w1', user_id: artist.id }]
      expect((await call({ method: 'POST', url: '/api/logistics/expeditions', token: curator.token, body: expedition({ artwork_ids: ['w1'] }) })).statusCode).toBe(403)
      expect((await call({ method: 'POST', url: '/api/logistics/expeditions', token: artist.token, body: expedition({ artwork_ids: ['w1'] }) })).statusCode).toBe(201)
      expect(db.tables.delivery_artwork_ids).toHaveLength(1)
      const buyer = db.addUser({ role: 'buyer' })
      expect((await call({ method: 'POST', url: '/api/logistics/expeditions', token: buyer.token, body: expedition() })).statusCode).toBe(403)
      expect((await call({ method: 'POST', url: '/api/logistics/expeditions', body: expedition() })).statusCode).toBe(401)
    })

    it('annulation : propriétaire ou admin seulement, une seule fois', async () => {
      const tid = (await call({ method: 'POST', url: '/api/logistics/expeditions', token: curator.token, body: expedition() })).body.expedition.trackingNumber
      expect((await call({ method: 'DELETE', url: `/api/logistics/cancel/${tid}`, token: artist.token })).statusCode).toBe(403)
      expect((await call({ method: 'DELETE', url: `/api/logistics/cancel/${tid}`, token: curator.token })).statusCode).toBe(200)
      expect((await call({ method: 'DELETE', url: `/api/logistics/cancel/${tid}`, token: curator.token })).statusCode).toBe(409)
      expect((await call({ url: `/api/logistics/track/${tid}` })).body.tracking.status).toBe('cancelled')
      expect((await call({ method: 'DELETE', url: '/api/logistics/cancel/KCB-TRK-NOPE0000', token: admin.token })).statusCode).toBe(404)
    })

    it('listes : l’admin voit tout, les autres uniquement leurs livraisons', async () => {
      await call({ method: 'POST', url: '/api/logistics/expeditions', token: curator.token, body: expedition() })
      await call({ method: 'POST', url: '/api/logistics/expeditions', token: artist.token, body: expedition() })
      expect((await call({ url: '/api/delivery', token: admin.token })).body.data).toHaveLength(2)
      const mine = (await call({ url: '/api/delivery', token: curator.token })).body.data
      expect(mine).toHaveLength(1)
      expect(mine[0]).toMatchObject({ trackingId: expect.stringMatching(/^KCB-TRK-/), _id: expect.any(String) })
      expect((await call({ url: '/api/delivery/my', token: admin.token })).body.data).toHaveLength(0)
      expect((await call({ url: '/api/logistics/expeditions', token: admin.token })).body.expeditions).toHaveLength(2)
      expect((await call({ url: '/api/logistics/expeditions', token: curator.token })).statusCode).toBe(403)
      expect((await call({ url: '/api/delivery' })).statusCode).toBe(401)
    })

    it('zones, tarifs, points relais : 501 explicite tant que Logidoo n’est pas branché (pas de données inventées)', async () => {
      for (const [method, url] of [['GET', '/api/logistics/zones'], ['GET', '/api/logistics/pickup-points'], ['POST', '/api/logistics/rates'], ['PUT', '/api/logistics/update/KCB-TRK-X']]) {
        const res = await call({ method, url, token: curator.token, body: {} })
        expect(res.statusCode, `${method} ${url}`).toBe(501)
        expect(res.body.error).toMatch(/Logidoo/)
      }
    })

    it('sync réservée à l’admin et renvoie syncedCount', async () => {
      expect((await call({ method: 'POST', url: '/api/logistics/sync', token: curator.token })).statusCode).toBe(403)
      expect((await call({ method: 'POST', url: '/api/logistics/sync', token: admin.token })).body).toMatchObject({ success: true, syncedCount: 0 })
    })
  })
})
