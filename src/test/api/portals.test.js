// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi } from './helpers'

let db, call, admin, artist, artist2, buyer, curator, advisor

beforeEach(async () => {
  ;({ db, call } = await loadApi())
  admin = db.addUser({ role: 'admin', email: 'admin@test.local' })
  artist = db.addUser({ role: 'artist', email: 'artist@test.local' })
  artist2 = db.addUser({ role: 'artist', email: 'artist2@test.local' })
  buyer = db.addUser({ role: 'buyer', email: 'buyer@test.local' })
  curator = db.addUser({ role: 'curator', email: 'curator@test.local' })
  advisor = db.addUser({ role: 'advisor', email: 'advisor@test.local' })
  // Essai de 14 jours créé à l'inscription : sans lui, curateur et advisor sont en lecture seule (402)
  const trialEnd = new Date(Date.now() + 14 * 864e5).toISOString()
  db.tables.subscriptions = [curator, advisor].map((u) => ({ id: `sub-${u.id}`, user_id: u.id, status: 'trial', end_date: trialEnd }))
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
})
afterEach(() => vi.unstubAllGlobals())

const newArtwork = (over = {}) => ({ title: 'Masque Baoulé', price: 150000, currency: 'XOF', for_sale: true, category: 'sculpture', ...over })

describe('Portail Artiste', () => {
  it('soumet une œuvre : créée en "pending", statut imposé par le serveur', async () => {
    const res = await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: newArtwork({ status: 'approved', kucibok_id: 'KCB-HACK0001' }) })
    expect(res.statusCode).toBe(201)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.kucibok_id).toBeUndefined()
  })

  it('refuse la soumission sans connexion et les prix négatifs', async () => {
    expect((await call({ method: 'POST', url: '/api/artworks', body: newArtwork() })).statusCode).toBe(401)
    expect((await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: newArtwork({ price: -5 }) })).statusCode).toBe(400)
  })

  it('ne peut ni s’approuver (PATCH) ni modifier l’œuvre d’un autre', async () => {
    const created = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: newArtwork() })).body.data
    expect((await call({ method: 'PATCH', url: `/api/artworks/${created.id}`, token: artist.token, body: { status: 'approved' } })).statusCode).toBe(403)
    expect((await call({ method: 'PUT', url: `/api/artworks/${created.id}`, token: artist2.token, body: { title: 'volé' } })).statusCode).toBe(403)
    expect((await call({ method: 'PUT', url: `/api/artworks/${created.id}`, token: artist.token, body: { title: 'Nouveau titre' } })).statusCode).toBe(200)
    expect((await call({ method: 'DELETE', url: `/api/artworks/${created.id}`, token: artist2.token })).statusCode).toBe(403)
  })

  it('voit ses œuvres dans /artworks/my, invisibles pour le public tant que non approuvées', async () => {
    const created = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: newArtwork() })).body.data
    const mine = await call({ url: '/api/artworks/my', token: artist.token })
    expect(mine.body.map((a) => a.id)).toContain(created.id)
    expect((await call({ url: `/api/artworks/${created.id}` })).statusCode).toBe(404)
    expect((await call({ url: `/api/artworks/${created.id}`, token: artist.token })).statusCode).toBe(200)
  })

  it('crée une demande de livraison et y rattache ses œuvres', async () => {
    const created = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: newArtwork() })).body.data
    const res = await call({
      method: 'POST', url: '/api/delivery/request', token: artist.token,
      body: { artwork_ids: [created.id], destination_country: 'FR' },
    })
    expect(res.statusCode).toBe(201)
    expect(db.tables.delivery_artwork_ids?.some((l) => l.artwork_id === created.id)).toBe(true)
  })

  it('un acheteur ne peut pas créer de livraison', async () => {
    const res = await call({ method: 'POST', url: '/api/delivery/request', token: buyer.token, body: { artwork_ids: ['x'], destination_country: 'FR' } })
    expect(res.statusCode).toBe(403)
  })
})

describe('Modération admin (onglets Pending / Approved / Rejected)', () => {
  let artworkId
  beforeEach(async () => {
    artworkId = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: newArtwork() })).body.data.id
  })

  it('l’admin approuve une œuvre en attente, elle devient publique', async () => {
    const res = await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: admin.token, body: { status: 'approved' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.data.status).toBe('approved')
    expect((await call({ url: `/api/artworks/${artworkId}` })).statusCode).toBe(200)
  })

  it('l’admin rejette puis ré-approuve', async () => {
    expect((await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: admin.token, body: { status: 'rejected' } })).body.data.status).toBe('rejected')
    expect((await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: admin.token, body: { status: 'approved' } })).body.data.status).toBe('approved')
  })

  it('refuse la modération aux non-admins, aux statuts invalides et aux œuvres inconnues', async () => {
    for (const who of [artist, buyer, curator, advisor]) {
      expect((await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: who.token, body: { status: 'approved' } })).statusCode).toBe(403)
    }
    expect((await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, body: { status: 'approved' } })).statusCode).toBe(401)
    expect((await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: admin.token, body: { status: 'sold' } })).statusCode).toBe(400)
    expect((await call({ method: 'PUT', url: '/api/artworks/00000000-0000-4000-8000-0000000000aa/approve', token: admin.token, body: { status: 'approved' } })).statusCode).toBe(404)
  })

  it('les listes admin Pending / Approved / Rejected sont filtrées par statut', async () => {
    const list = async (status) => (await call({ url: `/api/admin/artworks-list?status=${status}`, token: admin.token })).body.artworks
    expect((await list('pending')).map((a) => a.id)).toContain(artworkId)
    await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: admin.token, body: { status: 'rejected' } })
    expect(await list('pending')).toHaveLength(0)
    expect((await list('rejected')).map((a) => a.id)).toContain(artworkId)
    expect((await call({ url: '/api/admin/artworks-list?status=pending', token: artist.token })).statusCode).toBe(403)
  })

  it('l’admin renseigne l’adresse blockchain (https uniquement)', async () => {
    const ok = await call({ method: 'PUT', url: `/api/artworks/${artworkId}/etherscan`, token: admin.token, body: { etherscan: 'https://etherscan.io/tx/0xabc' } })
    expect(ok.statusCode).toBe(200)
    expect(ok.body.data.etherscan).toBe('https://etherscan.io/tx/0xabc')
    expect((await call({ method: 'PUT', url: `/api/artworks/${artworkId}/etherscan`, token: admin.token, body: { etherscan: 'javascript:alert(1)' } })).statusCode).toBe(400)
    expect((await call({ method: 'PUT', url: `/api/artworks/${artworkId}/etherscan`, token: artist.token, body: { etherscan: 'https://x.io' } })).statusCode).toBe(403)
  })

  it('statistiques admin cohérentes avec les listes', async () => {
    const stats = (await call({ url: '/api/admin/stats', token: admin.token })).body
    expect(stats).toMatchObject({ totalArtworks: 1, pendingArtworks: 1, approvedArtworks: 0, artists: 2 })
    expect((await call({ url: '/api/admin/stats', token: curator.token })).statusCode).toBe(403)
  })
})

describe('Portails Curateur et Advisor', () => {
  it.each([['curateur', () => curator, 'FR'], ['advisor', () => advisor, 'BE']])('le %s crée une demande de livraison', async (_label, who, country) => {
    const mine = (await call({ method: 'POST', url: '/api/artworks', token: who().token, body: newArtwork() })).body.data
    const res = await call({ method: 'POST', url: '/api/delivery/request', token: who().token, body: { artwork_ids: [mine.id], destination_country: country } })
    expect(res.statusCode).toBe(201)
  })

  it('refuse d’expédier l’œuvre d’un autre utilisateur', async () => {
    const theirs = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: newArtwork() })).body.data
    const res = await call({ method: 'POST', url: '/api/delivery/request', token: curator.token, body: { artwork_ids: [theirs.id], destination_country: 'FR' } })
    expect(res.statusCode).toBe(403)
    expect(db.tables.delivery_requests ?? []).toHaveLength(0)
  })

  it('la liste des utilisateurs est réservée à l’admin', async () => {
    expect((await call({ url: '/api/auth', token: admin.token })).statusCode).toBe(200)
    expect((await call({ url: '/api/auth', token: curator.token })).statusCode).toBe(403)
  })
})
