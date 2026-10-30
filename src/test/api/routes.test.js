// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi, mockPayDunya } from './helpers'

let db, call, paydunya, admin, artist, other, buyer, curator

beforeEach(async () => {
  ;({ db, call } = await loadApi())
  paydunya = mockPayDunya()
  admin = db.addUser({ role: 'admin', email: 'admin@test.local' })
  artist = db.addUser({ role: 'artist', email: 'artist@test.local' })
  other = db.addUser({ role: 'artist', email: 'other@test.local' })
  buyer = db.addUser({ role: 'buyer', email: 'buyer@test.local' })
  curator = db.addUser({ role: 'curator', email: 'curator@test.local' })
  db.tables.subscriptions = [{ id: 's-c', user_id: curator.id, status: 'trial', is_trial: true, end_date: new Date(Date.now() + 5 * 864e5).toISOString() }]
})
afterEach(() => vi.unstubAllGlobals())

const mkArtwork = async (token, body = {}) =>
  (await call({ method: 'POST', url: '/api/artworks', token, body: { title: 'Toile', price: 100000, currency: 'XOF', for_sale: true, ...body } })).body.data

describe('Réparation : abonnement actif et shortlist (route cassée par un collage de code)', () => {
  it('GET /subscriptions/active/:uid renvoie l’abonnement, refuse un autre utilisateur', async () => {
    const res = await call({ url: `/api/subscriptions/active/${curator.id}`, token: curator.token })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ success: true, data: { user_id: curator.id, status: 'trial' } })
    expect((await call({ url: `/api/subscriptions/active/${curator.id}`, token: buyer.token })).statusCode).toBe(403)
    expect((await call({ url: `/api/subscriptions/active/${buyer.id}`, token: buyer.token })).body.data).toBeNull()
  })

  it('shortlist : ajouter, doublon, vérifier, lister avec l’œuvre, notes, retirer', async () => {
    const w = await mkArtwork(artist.token)
    const add = await call({ method: 'POST', url: `/api/shortlist/${w.id}`, token: curator.token, body: { user_id: 'forgé', notes: 'à voir' } })
    expect(add.statusCode).toBe(201)
    expect(db.tables.shortlisted_artworks[0].user_id).toBe(curator.id) // l'identité vient du jeton
    expect((await call({ method: 'POST', url: `/api/shortlist/${w.id}`, token: curator.token, body: {} })).statusCode).toBe(409)
    expect((await call({ url: `/api/shortlist/check/${w.id}`, token: curator.token })).body.isShortlisted).toBe(true)
    expect((await call({ url: `/api/shortlist/check/${w.id}`, token: buyer.token })).body.isShortlisted).toBe(false)
    expect((await call({ url: '/api/shortlist', token: curator.token })).body.count).toBe(1)
    expect((await call({ method: 'PATCH', url: `/api/shortlist/${w.id}`, token: curator.token, body: { notes: 'prioritaire' } })).statusCode).toBe(200)
    expect((await call({ method: 'DELETE', url: `/api/shortlist/${w.id}`, token: curator.token })).statusCode).toBe(200)
    expect((await call({ url: '/api/shortlist', token: curator.token })).body.count).toBe(0)
  })
})

describe('Notifications', () => {
  it('approbation et rejet notifient l’artiste ; vente notifie le vendeur', async () => {
    const w1 = await mkArtwork(artist.token, { title: 'Approuvée' })
    const w2 = await mkArtwork(artist.token, { title: 'Rejetée' })
    await call({ method: 'PUT', url: `/api/artworks/${w1.id}/approve`, token: admin.token, body: { status: 'approved' } })
    await call({ method: 'PUT', url: `/api/artworks/${w2.id}/approve`, token: admin.token, body: { status: 'rejected' } })
    db.tables.artworks.find((a) => a.id === w1.id).sold = false
    const init = await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: w1.id } })
    paydunya.pay(init.body.data.token)
    await call({ method: 'POST', url: '/api/payments/ipn', body: { data: { invoice: { token: init.body.data.token } } } })

    const list = (await call({ url: '/api/notifications', token: artist.token })).body.data
    expect(list.map((n) => n.title).sort()).toEqual(['Œuvre approuvée', 'Œuvre rejetée', 'Œuvre vendue'])
    expect(list.every((n) => n._id && typeof n.time === 'string' && n.read === false)).toBe(true)
    expect((await call({ url: '/api/notifications', token: other.token })).body.data).toHaveLength(0)
  })

  it('marquer lu, tout lire, supprimer : seulement les siennes', async () => {
    const w = await mkArtwork(artist.token)
    await call({ method: 'PUT', url: `/api/artworks/${w.id}/approve`, token: admin.token, body: { status: 'approved' } })
    await call({ method: 'PUT', url: `/api/artworks/${w.id}/approve`, token: admin.token, body: { status: 'rejected' } })
    const [a, b] = (await call({ url: '/api/notifications', token: artist.token })).body.data
    expect((await call({ method: 'PATCH', url: `/api/notifications/${a.id}/read`, token: other.token })).statusCode).toBe(404)
    expect((await call({ method: 'PATCH', url: `/api/notifications/${a.id}/read`, token: artist.token })).statusCode).toBe(200)
    expect((await call({ method: 'PATCH', url: '/api/notifications/read-all', token: artist.token })).statusCode).toBe(200)
    expect(db.tables.notifications.every((n) => n.read)).toBe(true)
    expect((await call({ method: 'DELETE', url: `/api/notifications/${b.id}`, token: other.token })).statusCode).toBe(404)
    expect((await call({ method: 'DELETE', url: `/api/notifications/${b.id}`, token: artist.token })).statusCode).toBe(200)
    expect((await call({ method: 'DELETE', url: '/api/notifications', token: artist.token })).statusCode).toBe(200)
    expect((await call({ url: '/api/notifications' })).statusCode).toBe(401)
  })

  it('table absente : la modération réussit quand même (notification non bloquante)', async () => {
    db.failTables.add('notifications')
    const w = await mkArtwork(artist.token)
    expect((await call({ method: 'PUT', url: `/api/artworks/${w.id}/approve`, token: admin.token, body: { status: 'approved' } })).statusCode).toBe(200)
  })
})

describe('Galeries (admin)', () => {
  const multipart = (filename, content) => {
    const boundary = '----kcbtest'
    const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/csv\r\n\r\n${content}\r\n--${boundary}--\r\n`)
    return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
  }

  it('importe un CSV, ignore doublons et lignes invalides, puis liste', async () => {
    const csv = 'name,email\nGalerie Dakar,contact@dakar.test\nGalerie Paris,"info@paris.test"\nSans mail,\nDoublon,CONTACT@dakar.test\n'
    const first = await call({ method: 'POST', url: '/api/galleries/import', token: admin.token, ...multipart('galeries.csv', csv) })
    expect(first.statusCode).toBe(200)
    expect(first.body).toMatchObject({ success: true, count: 2, skipped: 2 })
    const again = await call({ method: 'POST', url: '/api/galleries/import', token: admin.token, ...multipart('galeries.csv', csv) })
    expect(again.body.count).toBe(0)
    const list = await call({ url: '/api/galleries', token: admin.token })
    expect(list.body.galleries.map((g) => g.email).sort()).toEqual(['contact@dakar.test', 'info@paris.test'])
    expect(list.body.total).toBe(2)
  })

  it('accepte le point-virgule, refuse xlsx, en-têtes absents, non-admin', async () => {
    expect((await call({ method: 'POST', url: '/api/galleries/import', token: admin.token, ...multipart('g.csv', 'nom;mail\nA;a@a.test\n') })).body.count).toBe(1)
    expect((await call({ method: 'POST', url: '/api/galleries/import', token: admin.token, ...multipart('g.xlsx', 'x') })).statusCode).toBe(415)
    expect((await call({ method: 'POST', url: '/api/galleries/import', token: admin.token, ...multipart('g.csv', 'a,b\n1,2\n') })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: '/api/galleries/import', token: admin.token, body: Buffer.from(''), headers: {} })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: '/api/galleries/import', token: artist.token, ...multipart('g.csv', 'name,email\nA,a@a.test\n') })).statusCode).toBe(403)
    expect((await call({ url: '/api/galleries', token: artist.token })).statusCode).toBe(403)
  })
})

describe('Livraisons : création, suivi, statut admin, alertes', () => {
  const shipment = (artworkId) => ({
    corridor: 'AF_TO_FR', originCountry: 'SN', deliveryAddress: '1 rue de Paris', recipientName: 'M. Dupont', recipientPhone: '+33100000000',
    collectDate: '2026-11-10', deliveryDate: '2026-11-25', packageSize: 'medium', packageWeight: '4', deliveryPriority: 'express',
    packagingChecklist: { museum_wrap: true, crate: true }, artworkIds: [artworkId],
  })

  it('l’artiste crée, suit ; l’admin fait avancer le statut ; la synchro crée les alertes', async () => {
    const w = await mkArtwork(artist.token)
    const created = await call({ method: 'POST', url: '/api/delivery', token: artist.token, body: shipment(w.id) })
    expect(created.statusCode).toBe(201)
    const d = created.body.data
    expect(d).toMatchObject({ _id: expect.any(String), trackingId: expect.stringMatching(/^KCB-TRK-/), corridor: 'AF_TO_FR' })
    expect(db.tables.delivery_requests[0]).toMatchObject({ origin_country: 'SN', museum_wrap: true, crate: true, bubble_wrap: false })

    expect((await call({ url: `/api/delivery/${d._id}`, token: artist.token })).body.data.events).toHaveLength(1)
    expect((await call({ url: `/api/delivery/${d._id}`, token: other.token })).statusCode).toBe(404)

    expect((await call({ method: 'PATCH', url: `/api/delivery/${d._id}`, token: artist.token, body: { status: 'delivered' } })).statusCode).toBe(403)
    expect((await call({ method: 'PATCH', url: `/api/delivery/${d._id}`, token: admin.token, body: { status: 'teleported' } })).statusCode).toBe(400)
    const moved = await call({ method: 'PATCH', url: `/api/delivery/${d._id}`, token: admin.token, body: { status: 'in_transit', note: 'Départ de Dakar' } })
    expect(moved.body.data.status).toBe('in_transit')
    expect((await call({ url: `/api/delivery/track/${d.trackingId}` })).body.data.events.map((e) => e.status)).toEqual(['pending', 'in_transit'])

    for (const e of db.tables.delivery_events) e.delivery_requests = { tracking_id: d.trackingId } // jointure simulée
    const sync = await call({ method: 'POST', url: '/api/logistics/sync', token: admin.token })
    expect(sync.body.created).toBe(2)
    expect((await call({ method: 'DELETE', url: `/api/delivery/${d._id}`, token: artist.token })).statusCode).toBe(403)
    expect((await call({ method: 'DELETE', url: `/api/delivery/${d._id}`, token: admin.token })).statusCode).toBe(200)
    expect((await call({ url: `/api/delivery/${d._id}`, token: admin.token })).statusCode).toBe(404)
  })

  it('champs obligatoires, rôle, propriété des œuvres', async () => {
    const w = await mkArtwork(artist.token)
    expect((await call({ method: 'POST', url: '/api/delivery', token: artist.token, body: { artworkIds: [w.id] } })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: '/api/delivery', token: buyer.token, body: shipment(w.id) })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/delivery', token: other.token, body: shipment(w.id) })).statusCode).toBe(403)
    expect(db.tables.delivery_requests ?? []).toHaveLength(0)
  })
})

describe('Numérisation', () => {
  it('l’artiste demande pour sa propre œuvre ; l’admin traite ; suppression encadrée', async () => {
    const mine = await mkArtwork(artist.token)
    const theirs = await mkArtwork(other.token)
    expect((await call({ method: 'POST', url: '/api/numerisation', token: artist.token, body: { artwork_id: theirs.id } })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/numerisation', token: artist.token, body: {} })).statusCode).toBe(400)
    const created = await call({ method: 'POST', url: '/api/numerisation', token: artist.token, body: { artwork_id: mine.id, notes: 'Haute définition' } })
    expect(created.statusCode).toBe(201)
    const id = created.body.data._id
    expect((await call({ url: '/api/numerisation/my', token: artist.token })).body.data).toHaveLength(1)
    expect((await call({ url: '/api/numerisation', token: other.token })).body.data).toHaveLength(0)
    expect((await call({ url: '/api/numerisation', token: admin.token })).body.data).toHaveLength(1)
    expect((await call({ method: 'PATCH', url: `/api/numerisation/${id}`, token: artist.token, body: { status: 'completed' } })).statusCode).toBe(403)
    expect((await call({ method: 'PATCH', url: `/api/numerisation/${id}`, token: admin.token, body: { status: 'nope' } })).statusCode).toBe(400)
    expect((await call({ method: 'PATCH', url: `/api/numerisation/${id}`, token: admin.token, body: { status: 'in_progress' } })).body.data.status).toBe('in_progress')
    expect((await call({ method: 'DELETE', url: `/api/numerisation/${id}`, token: artist.token })).statusCode).toBe(403) // plus en attente
    expect((await call({ method: 'DELETE', url: `/api/numerisation/${id}`, token: admin.token })).statusCode).toBe(200)
  })
})

describe('Abonnement : consultation et annulation', () => {
  it('current renvoie l’abonnement ; annuler garde l’accès jusqu’à la fin de période', async () => {
    expect((await call({ url: '/api/subscriptions/current', token: buyer.token })).statusCode).toBe(404)
    const cur = await call({ url: '/api/subscriptions/current', token: curator.token })
    expect(cur.body).toMatchObject({ user_id: curator.id, status: 'trial' })
    expect((await call({ method: 'POST', url: '/api/subscription/cancel', token: buyer.token })).statusCode).toBe(404)
    expect((await call({ method: 'POST', url: '/api/subscription/cancel', token: curator.token })).body.data.status).toBe('cancelled')
    expect((await call({ url: '/api/subscriptions/current', token: curator.token })).body.status).toBe('cancelled')
    // payé jusqu'au bout : l'écriture reste autorisée (pas de 402)
    expect((await call({ method: 'POST', url: '/api/artworks', token: curator.token, body: { title: 'ok' } })).statusCode).toBe(201)
    db.tables.subscriptions[0].end_date = new Date(Date.now() - 1000).toISOString()
    expect((await call({ method: 'POST', url: '/api/artworks', token: curator.token, body: { title: 'trop tard' } })).statusCode).toBe(402)
  })
})

describe('Admin : transactions, support, sourcing', () => {
  it('transactions : liste admin avec type', async () => {
    db.tables.transactions = [{ id: 't1', artwork_id: 'w', amount: 5, status: 'completed' }, { id: 't2', artwork_id: null, amount: 9, status: 'completed' }]
    const res = await call({ url: '/api/transactions', token: admin.token })
    expect(res.body.data.map((t) => t.type).sort()).toEqual(['artwork', 'subscription'])
    expect((await call({ url: '/api/transactions', token: artist.token })).statusCode).toBe(403)
  })

  it('support : statistiques admin, détail limité au propriétaire', async () => {
    const t = (await call({ method: 'POST', url: '/api/support-tickets/create', token: artist.token, body: { subject: 'Aide', description: 'Besoin' } })).body.ticket
    expect((await call({ url: '/api/support-tickets/admin/stats', token: admin.token })).body.stats).toMatchObject({ total: 1, byStatus: { open: 1 } })
    expect((await call({ url: `/api/support-tickets/ticket/${t.id}`, token: artist.token })).statusCode).toBe(200)
    expect((await call({ url: `/api/support-tickets/ticket/${t.id}`, token: other.token })).statusCode).toBe(404)
    expect((await call({ url: '/api/support-tickets/admin/stats', token: artist.token })).statusCode).toBe(403)
  })

  it('sourcing : créer sa demande, lister uniquement les siennes', async () => {
    expect((await call({ method: 'POST', url: '/api/sourcing', token: curator.token, body: { purpose: 'Expo' } })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: '/api/sourcing', token: curator.token, body: { purpose: 'Expo 2027', message: 'Cherche 5 sculptures', budget: '2500000' } })).statusCode).toBe(201)
    expect((await call({ url: '/api/sourcing/mine', token: curator.token })).body.data).toHaveLength(1)
    expect((await call({ url: '/api/sourcing/mine', token: buyer.token })).body.data).toHaveLength(0)
    expect((await call({ method: 'POST', url: '/api/sourcing', body: { purpose: 'x', message: 'y' } })).statusCode).toBe(401)
  })
})

describe('Compte : mot de passe et gestion des utilisateurs', () => {
  it('réinitialisation (session de récupération) : 8 caractères minimum', async () => {
    expect((await call({ method: 'POST', url: '/api/auth/reset-password', body: { password: 'NouveauMdp123' } })).statusCode).toBe(401)
    expect((await call({ method: 'POST', url: '/api/auth/reset-password', token: buyer.token, body: { password: 'court' } })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: '/api/auth/reset-password', token: buyer.token, body: { password: 'NouveauMdp123' } })).statusCode).toBe(200)
  })

  it('changement : ancien mot de passe vérifié côté serveur', async () => {
    process.env.SUPABASE_ANON_KEY = 'anon'
    const url = '/api/auth/change-password'
    expect((await call({ method: 'POST', url, token: buyer.token, body: { oldPassword: 'mauvais', newPassword: 'NouveauMdp123' } })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url, token: buyer.token, body: { oldPassword: 'Password123!', newPassword: 'court' } })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url, token: buyer.token, body: { oldPassword: 'Password123!', newPassword: 'Password123!' } })).statusCode).toBe(400)
    const ok = await call({ method: 'POST', url, token: buyer.token, body: { oldPassword: 'Password123!', newPassword: 'NouveauMdp123' } })
    expect(ok.statusCode).toBe(200)
    expect(ok.body.data._id).toBe(buyer.id)
    expect((await call({ method: 'POST', url, token: buyer.token, body: { oldPassword: 'Password123!', newPassword: 'Autre12345' } })).statusCode).toBe(403)
    delete process.env.SUPABASE_ANON_KEY
    expect((await call({ method: 'POST', url, token: buyer.token, body: { oldPassword: 'NouveauMdp123', newPassword: 'Autre12345' } })).statusCode).toBe(500)
  })

  it('admin : créer, consulter, désactiver/réactiver, supprimer un utilisateur', async () => {
    expect((await call({ method: 'POST', url: '/api/auth', token: artist.token, body: { email: 'x@x.test', password: 'Password123!' } })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/auth', token: admin.token, body: { email: 'pas-un-mail', password: 'Password123!' } })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: '/api/auth', token: admin.token, body: { email: 'x@x.test', password: 'court' } })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: '/api/auth', token: admin.token, body: { email: 'x@x.test', password: 'Password123!', role: 'superadmin' } })).statusCode).toBe(400)
    const created = await call({ method: 'POST', url: '/api/auth', token: admin.token, body: { email: 'neuf@x.test', password: 'Password123!', name: 'Neuf', role: 'curator' } })
    expect(created.statusCode).toBe(201)
    const id = created.body.data._id
    expect(created.body.data).toMatchObject({ role: 'curator', name: 'Neuf' })
    expect((await call({ url: `/api/auth/${id}`, token: admin.token })).body.data.email).toBe('neuf@x.test')
    expect((await call({ url: `/api/auth/${id}`, token: artist.token })).statusCode).toBe(403)

    const off = await call({ method: 'POST', url: `/api/auth/status/${id}`, token: admin.token })
    expect(off.body.data.is_active).toBe(false)
    expect((await call({ method: 'POST', url: `/api/auth/status/${id}`, token: admin.token })).body.data.is_active).toBe(true)
    expect((await call({ method: 'POST', url: `/api/auth/status/${admin.id}`, token: admin.token })).statusCode).toBe(400)
    expect((await call({ method: 'POST', url: `/api/auth/status/${id}`, token: artist.token })).statusCode).toBe(403)

    expect((await call({ method: 'DELETE', url: `/api/auth/${admin.id}`, token: admin.token })).statusCode).toBe(400)
    expect((await call({ method: 'DELETE', url: `/api/auth/${id}`, token: artist.token })).statusCode).toBe(403)
    expect((await call({ method: 'DELETE', url: `/api/auth/${id}`, token: admin.token })).statusCode).toBe(200)
    expect((await call({ method: 'DELETE', url: `/api/auth/${id}`, token: admin.token })).statusCode).toBe(404)
  })

  it('liste admin : _id présent (les actions de l’interface utilisent _id)', async () => {
    const users = (await call({ url: '/api/admin/users-list', token: admin.token })).body.users
    expect(users.every((u) => u._id === u.id)).toBe(true)
  })

  it('déconnexion idempotente', async () => {
    expect((await call({ method: 'POST', url: '/api/auth/logout', token: buyer.token })).statusCode).toBe(200)
    expect((await call({ method: 'POST', url: '/api/auth/logout' })).statusCode).toBe(200)
  })
})
