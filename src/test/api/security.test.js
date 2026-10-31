// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi } from './helpers'

let db, call, artist, other, buyer, admin

beforeEach(async () => {
  ;({ db, call } = await loadApi())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ response_code: '99', response_text: 'secret-config-detail' }) })))
  artist = db.addUser({ role: 'artist', email: 'artist@test.local' })
  other = db.addUser({ role: 'artist', email: 'other@test.local' })
  buyer = db.addUser({ role: 'buyer', email: 'buyer@test.local' })
  admin = db.addUser({ role: 'admin', email: 'admin@test.local' })
  db.tables.artists = [{ id: 'a1', user_id: artist.id, name: 'Artiste', total_sales: 12, total_earnings: 3400000 }]
})
afterEach(() => vi.unstubAllGlobals())

describe('Ventes et gains des artistes jamais publics', () => {
  const leaks = (body) => /total_sales|total_earnings|3400000/.test(JSON.stringify(body))

  it.each(['/api/artists', '/api/artist', '/api/artists/a1'])('%s (anonyme) ne contient ni ventes ni gains', async (url) => {
    const res = await call({ url })
    expect(res.statusCode).toBe(200)
    expect(leaks(res.body)).toBe(false)
  })

  it('/api/profile/:id : masqué pour les tiers, visible pour le titulaire et l’admin', async () => {
    expect(leaks((await call({ url: `/api/profile/${artist.id}` })).body)).toBe(false)
    expect(leaks((await call({ url: `/api/profile/${artist.id}`, token: other.token })).body)).toBe(false)
    expect(leaks((await call({ url: `/api/profile/${artist.id}`, token: artist.token })).body)).toBe(true)
    expect(leaks((await call({ url: `/api/profile/${artist.id}`, token: admin.token })).body)).toBe(true)
  })
})

describe('Autres garde-fous', () => {
  it('set-role : un compte Google ayant terminé l’onboarding ne peut plus changer de rôle', async () => {
    const g = db.addUser({ role: 'buyer', email: 'g@test.local' })
    Object.assign(db.tables.users.find((u) => u.id === g.id), { auth_provider: 'google', onboarding_completed: true })
    expect((await call({ method: 'POST', url: '/api/auth/set-role', token: g.token, body: { role: 'advisor' } })).statusCode).toBe(403)
    const fresh = db.addUser({ role: 'buyer', email: 'f@test.local' })
    Object.assign(db.tables.users.find((u) => u.id === fresh.id), { auth_provider: 'google', onboarding_completed: false })
    expect((await call({ method: 'POST', url: '/api/auth/set-role', token: fresh.token, body: { role: 'artist' } })).statusCode).toBe(200)
    expect((await call({ method: 'POST', url: '/api/auth/set-role', token: fresh.token, body: { role: 'admin' } })).statusCode).toBe(400)
  })

  it('une erreur PayDunya ne divulgue ni mode ni longueur de clés au client', async () => {
    const w = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: { title: 'x', price: 1000, currency: 'XOF', for_sale: true } })).body.data
    db.tables.artworks.find((a) => a.id === w.id).sold = false
    await call({ method: 'PUT', url: `/api/artworks/${w.id}/approve`, token: admin.token, body: { status: 'approved' } })
    const res = await call({ method: 'POST', url: '/api/payments/paydunya-init', token: buyer.token, body: { type: 'artwork', artwork_id: w.id } })
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(res.body)).not.toMatch(/key_length|mode|secret-config-detail|paydunya/i)
  })

  it('GET /api/artworks n’expose pas de champ de debug en production', async () => {
    process.env.VERCEL_ENV = 'production'
    const res = await call({ url: '/api/artworks' })
    delete process.env.VERCEL_ENV
    expect(res.body).not.toHaveProperty('_debug')
  })

  it('rôles : un utilisateur ne peut pas s’attribuer admin', async () => {
    const res = await call({ method: 'PUT', url: `/api/auth/${artist.id}`, token: artist.token, body: { role: 'admin' } })
    expect(db.tables.users.find((u) => u.id === artist.id).role).toBe('artist')
    expect([200, 400, 403]).toContain(res.statusCode)
  })
})
