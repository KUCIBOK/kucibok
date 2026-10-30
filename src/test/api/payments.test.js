// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi, mockPayDunya } from './helpers'

let db, call, paydunya, admin, artist, buyer, curator, advisor

beforeEach(async () => {
  ;({ db, call } = await loadApi())
  paydunya = mockPayDunya()
  admin = db.addUser({ role: 'admin' })
  artist = db.addUser({ role: 'artist' })
  buyer = db.addUser({ role: 'buyer', email: 'buyer@test.local' })
  curator = db.addUser({ role: 'curator' })
  advisor = db.addUser({ role: 'advisor' })
})
afterEach(() => vi.unstubAllGlobals())

const ipn = (token) => call({ method: 'POST', url: '/api/payments/ipn', body: { data: { invoice: { token } } } })
const activeSubs = (userId) => (db.tables.subscriptions || []).filter((s) => s.user_id === userId && s.status === 'active')

describe('Abonnement payant (curateur / advisor)', () => {
  it.each([['curateur', () => curator, 17711], ['advisor', () => advisor, 43949]])(
    '%s : checkout -> paiement PayDunya -> IPN -> abonnement actif, débloque l’écriture',
    async (_label, who, price) => {
      // Sans abonnement : lecture seule
      const blocked = await call({ method: 'POST', url: '/api/artworks', token: who().token, body: { title: 'x' } })
      expect(blocked.statusCode).toBe(402)

      const checkout = await call({ method: 'POST', url: '/api/subscriptions/checkout', token: who().token })
      expect(checkout.statusCode).toBe(200)
      expect(checkout.body.checkout_url).toMatch(/^https:\/\/pay\.test\//)
      const token = checkout.body.checkout_url.split('/').pop()
      expect(paydunya.invoices[token].body.invoice.total_amount).toBe(price)

      // Paiement non terminé : rien ne change
      expect((await ipn(token)).body).toBe('not completed')
      expect(activeSubs(who().id)).toHaveLength(0)

      // Paiement confirmé par PayDunya
      paydunya.pay(token)
      expect((await ipn(token)).body).toBe('OK')
      expect(activeSubs(who().id)).toHaveLength(1)
      expect(db.tables.transactions.find((t) => t.payment_ref === token).status).toBe('completed')

      // Rejeu de la notification : pas de second abonnement
      expect((await ipn(token)).body).toBe('already processed')
      expect(activeSubs(who().id)).toHaveLength(1)

      // L'écriture est de nouveau autorisée
      const ok = await call({ method: 'POST', url: '/api/artworks', token: who().token, body: { title: 'Après paiement' } })
      expect(ok.statusCode).toBe(201)
    }
  )

  it('réservé aux curateurs et advisors, authentification obligatoire', async () => {
    expect((await call({ method: 'POST', url: '/api/subscriptions/checkout' })).statusCode).toBe(401)
    for (const who of [artist, buyer, admin]) {
      expect((await call({ method: 'POST', url: '/api/subscriptions/checkout', token: who.token })).statusCode).toBe(403)
    }
  })

  it('PayDunya indisponible : 502 et aucune transaction créée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ response_code: '01' }) })))
    const res = await call({ method: 'POST', url: '/api/subscriptions/checkout', token: curator.token })
    expect(res.statusCode).toBe(502)
    expect(db.tables.transactions ?? []).toHaveLength(0)
  })

  it('un faux IPN (jeton inconnu / sans jeton) n’active rien', async () => {
    expect((await call({ method: 'POST', url: '/api/payments/ipn', body: {} })).statusCode).toBe(400)
    paydunya.invoices.fake = { status: 'completed' }
    expect((await ipn('fake')).statusCode).toBe(404)
    expect(db.tables.subscriptions ?? []).toHaveLength(0)
  })

  it('l’admin peut activer manuellement, pas les autres', async () => {
    expect((await call({ method: 'POST', url: '/api/admin/subscriptions/activate', token: artist.token, body: { user_id: curator.id } })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/admin/subscriptions/activate', token: admin.token, body: { user_id: curator.id } })).statusCode).toBe(200)
    expect(activeSubs(curator.id)).toHaveLength(1)
  })
})

describe('Achat d’une œuvre', () => {
  let artworkId
  beforeEach(async () => {
    const created = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: { title: 'Toile', price: 200000, currency: 'XOF', for_sale: true } })).body.data
    artworkId = created.id
    Object.assign(db.tables.artworks.find((a) => a.id === artworkId), { sold: false })
    await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: admin.token, body: { status: 'approved' } })
  })

  it('acheteur connecté : paiement -> IPN -> œuvre vendue', async () => {
    const init = await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: artworkId } })
    expect(init.statusCode).toBe(200)
    const { token } = init.body.data
    expect(paydunya.invoices[token].body.invoice.total_amount).toBe(200000)

    paydunya.pay(token)
    expect((await ipn(token)).body).toBe('OK')
    const art = db.tables.artworks.find((a) => a.id === artworkId)
    expect(art).toMatchObject({ sold: true, for_sale: false, sold_price: 200000 })
    expect((await ipn(token)).body).toBe('already processed')
  })

  it('page de retour : la référence de transaction renvoie le statut final', async () => {
    const init = await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: artworkId } })
    const tx = db.tables.transactions.find((t) => t.payment_ref === init.body.data.token)
    paydunya.pay(init.body.data.token)
    const cb = await call({ method: 'POST', url: '/api/payments/paydunya-callback', body: { token: tx.id } })
    expect(cb.statusCode).toBe(200)
    expect(cb.body.data).toMatchObject({ status: 'completed', amount: 200000 })
  })

  it('achat invité : nom et e-mail obligatoires', async () => {
    const bad = await call({ method: 'POST', url: '/api/payments/paydunya-init', body: { type: 'artwork', artwork_id: artworkId } })
    expect(bad.statusCode).toBe(400)
    const ok = await call({ method: 'POST', url: '/api/payments/paydunya-init', body: { type: 'artwork', artwork_id: artworkId, guest: { name: 'Awa', email: 'awa@test.local' } } })
    expect(ok.statusCode).toBe(200)
  })

  it('deux acheteurs payent la même œuvre : un seul gagne, l’autre est marqué indisponible', async () => {
    const a = await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: artworkId } })
    const b = await call({ method: 'POST', url: '/api/payments/paydunya-init', body: { type: 'artwork', artwork_id: artworkId, guest: { name: 'Awa', email: 'awa@test.local' } } })
    paydunya.pay(a.body.data.token)
    paydunya.pay(b.body.data.token)
    expect((await ipn(a.body.data.token)).body).toBe('OK')
    expect((await ipn(b.body.data.token)).body).toBe('artwork already sold')
    expect(db.tables.transactions.find((t) => t.payment_ref === b.body.data.token).status).toBe('completed_unavailable')
  })

  it('œuvre vendue, non approuvée ou inconnue : 404', async () => {
    db.tables.artworks.find((a) => a.id === artworkId).sold = true
    expect((await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: artworkId } })).statusCode).toBe(404)
    expect((await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: '00000000-0000-4000-8000-00000000dead' } })).statusCode).toBe(404)
  })

  it('PayDunya en panne : transaction passée en "failed", 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ response_code: '99', response_text: 'down' }) })))
    const res = await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: artworkId } })
    expect(res.statusCode).toBe(502)
    expect(db.tables.transactions.at(-1).status).toBe('failed')
  })

  it('le montant payé vient du serveur, jamais du client', async () => {
    const res = await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: artworkId, amount: 1, price: 1 } })
    expect(paydunya.invoices[res.body.data.token].body.invoice.total_amount).toBe(200000)
  })
})

describe('Ventes artiste, journal et support', () => {
  it('"Mes ventes" : l’artiste voit ses ventes payées et en attente, pas celles des autres', async () => {
    const other = db.addUser({ role: 'artist' })
    const mk = async (token, title) => {
      const w = (await call({ method: 'POST', url: '/api/artworks', token, body: { title, price: 100000, currency: 'XOF', for_sale: true } })).body.data
      db.tables.artworks.find((a) => a.id === w.id).sold = false
      await call({ method: 'PUT', url: `/api/artworks/${w.id}/approve`, token: admin.token, body: { status: 'approved' } })
      return w.id
    }
    const mine = await mk(artist.token, 'À moi')
    const theirs = await mk(other.token, 'À un autre')
    const paid = (await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: mine } })).body.data.token
    await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: theirs } })
    paydunya.pay(paid)
    await call({ method: 'POST', url: '/api/payments/ipn', body: { data: { invoice: { token: paid } } } })
    expect(db.tables.transactions.find((t) => t.payment_ref === paid).seller_id).toBe(artist.id)

    const res = await call({ url: '/api/transactions/artist', token: artist.token })
    expect(res.statusCode).toBe(200)
    expect(res.body.data.stats).toMatchObject({ currency: 'XOF', totalRevenue: 100000, completedSales: 1, pendingSales: 0, totalCommission: 0 })
    expect(res.body.data.transactions).toHaveLength(1)
    expect(res.body.data.transactions[0].artworks.title).toBe('À moi')
    expect((await call({ url: '/api/transactions/artist', token: buyer.token })).statusCode).toBe(403)
    expect((await call({ url: '/api/transactions/artist' })).statusCode).toBe(401)
  })

  it('journal d’audit : écriture avec l’identité du jeton, lecture réservée à l’admin', async () => {
    await call({ method: 'POST', url: '/api/log', token: admin.token, body: { description: 'Approbation de l’œuvre X', userId: artist.id } })
    await call({ method: 'POST', url: '/api/log', body: { description: 'anonyme : ignoré' } })
    const rows = (await call({ url: '/api/log', token: admin.token })).body
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user_id: admin.id, description: 'Approbation de l’œuvre X' })
    expect((await call({ url: '/api/log', token: artist.token })).statusCode).toBe(403)
  })

  it('report-error : accepté sans connexion, message obligatoire', async () => {
    expect((await call({ method: 'POST', url: '/api/report-error', body: { error_message: 'boom', error_type: 'react' } })).statusCode).toBe(202)
    expect((await call({ method: 'POST', url: '/api/report-error', body: {} })).statusCode).toBe(400)
  })

  it('tickets support : création par l’utilisateur, liste complète réservée à l’admin', async () => {
    expect((await call({ method: 'POST', url: '/api/support-tickets/create', token: artist.token, body: { subject: 'Aide', description: 'Je ne vois pas mes ventes' } })).statusCode).toBe(201)
    const all = await call({ url: '/api/support-tickets/admin/all', token: admin.token })
    expect(all.body).toMatchObject({ success: true, count: 1 })
    expect((await call({ url: '/api/support-tickets/admin/all', token: artist.token })).statusCode).toBe(403)
  })
})

