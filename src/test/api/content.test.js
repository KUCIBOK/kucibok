// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi } from './helpers'

let db, call, admin, artist, curator, advisor, buyer

beforeEach(async () => {
  ;({ db, call } = await loadApi())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
  admin = db.addUser({ role: 'admin', email: 'admin@test.local' })
  artist = db.addUser({ role: 'artist', email: 'artist@test.local' })
  curator = db.addUser({ role: 'curator', email: 'curator@test.local' })
  advisor = db.addUser({ role: 'advisor', email: 'advisor@test.local' })
  buyer = db.addUser({ role: 'buyer', email: 'buyer@test.local' })
  const end = new Date(Date.now() + 5 * 864e5).toISOString()
  db.tables.subscriptions = [curator, advisor].map((u) => ({ id: `s-${u.id}`, user_id: u.id, status: 'trial', end_date: end }))
})
afterEach(() => vi.unstubAllGlobals())

describe('Catégories', () => {
  it('liste publique issue de la base (plus de données codées en dur)', async () => {
    expect((await call({ url: '/api/category' })).body.data).toEqual([])
    db.tables.categories = [{ id: 'c1', name: 'Sculpture' }]
    const list = (await call({ url: '/api/category' })).body.data
    expect(list).toEqual([expect.objectContaining({ name: 'Sculpture', title: 'Sculpture', _id: 'c1' })])
  })

  it('l’admin crée et supprime ; doublon 409 ; les autres 403', async () => {
    expect((await call({ method: 'POST', url: '/api/category', token: artist.token, body: { title: 'Textile' } })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/category', body: { title: 'Textile' } })).statusCode).toBe(401)
    expect((await call({ method: 'POST', url: '/api/category', token: admin.token, body: { title: 'x' } })).statusCode).toBe(400)
    const created = await call({ method: 'POST', url: '/api/category', token: admin.token, body: { title: 'Textile' } })
    expect(created.statusCode).toBe(201)
    expect(created.body.data.title).toBe('Textile')
    expect((await call({ method: 'POST', url: '/api/category', token: admin.token, body: { title: 'Textile' } })).statusCode).toBe(409)
    const id = created.body.data.id
    expect((await call({ method: 'DELETE', url: `/api/category/${id}`, token: artist.token })).statusCode).toBe(403)
    expect((await call({ method: 'DELETE', url: `/api/category/${id}`, token: admin.token })).statusCode).toBe(200)
    expect((await call({ method: 'DELETE', url: `/api/category/${id}`, token: admin.token })).statusCode).toBe(404)
  })
})

describe('Plans d’abonnement', () => {
  const plan = (over = {}) => ({ name: 'Curateur', description: 'Accès complet', price: 27, currency: 'EUR', duration: 'monthly', role: 'curator', features: ['Catalogue certifié', 'Shortlist'], ...over })

  it('création, lecture publique des plans actifs, modification, suppression', async () => {
    expect((await call({ url: '/api/plan' })).body.data).toEqual([])
    expect((await call({ method: 'POST', url: '/api/plan', token: curator.token, body: plan() })).statusCode).toBe(403)
    const created = await call({ method: 'POST', url: '/api/plan', token: admin.token, body: plan() })
    expect(created.statusCode).toBe(201)
    expect(created.body.data).toMatchObject({ name: 'Curateur', price: 27, currency: 'EUR', duration: 'monthly', role: 'curator', features: ['Catalogue certifié', 'Shortlist'] })
    const id = created.body.data.id

    expect((await call({ url: '/api/plan' })).body.data).toHaveLength(1)
    expect((await call({ url: `/api/plan/${id}` })).body.data.name).toBe('Curateur')

    const updated = await call({ method: 'PUT', url: `/api/plan/${id}`, token: admin.token, body: { price: 30, duration: 'yearly', is_active: false } })
    expect(updated.body.data).toMatchObject({ price: 30, duration: 'yearly', is_active: false })
    // inactif : caché au public, visible pour l'admin
    expect((await call({ url: '/api/plan' })).body.data).toHaveLength(0)
    expect((await call({ url: `/api/plan/${id}` })).statusCode).toBe(404)
    expect((await call({ url: '/api/plan', token: admin.token })).body.data).toHaveLength(1)
    expect((await call({ method: 'DELETE', url: `/api/plan/${id}`, token: curator.token })).statusCode).toBe(403)
    expect((await call({ method: 'DELETE', url: `/api/plan/${id}`, token: admin.token })).statusCode).toBe(200)
    expect((await call({ method: 'DELETE', url: `/api/plan/${id}`, token: admin.token })).statusCode).toBe(404)
  })

  it('valide le prix, la devise, le rôle, la durée et les fonctionnalités', async () => {
    const bad = async (over) => (await call({ method: 'POST', url: '/api/plan', token: admin.token, body: plan(over) })).statusCode
    expect(await bad({ price: -1 })).toBe(400)
    expect(await bad({ price: 'abc' })).toBe(400)
    expect(await bad({ currency: 'GBP' })).toBe(400)
    expect(await bad({ role: 'superuser' })).toBe(400)
    expect(await bad({ duration: 'weekly' })).toBe(400)
    expect(await bad({ name: 'x' })).toBe(400)
    expect(await bad({ features: ['ok', ''] })).toBe(400)
    expect(await bad({ features: new Array(21).fill('f') })).toBe(400)
    expect(db.tables.plans ?? []).toHaveLength(0)
  })

  it('un plan utilisé par des abonnements ne peut pas être supprimé (409)', async () => {
    const id = (await call({ method: 'POST', url: '/api/plan', token: admin.token, body: plan() })).body.data.id
    db.tables.subscriptions.push({ id: 's-x', user_id: curator.id, plan_id: id, status: 'active' })
    const res = await call({ method: 'DELETE', url: `/api/plan/${id}`, token: admin.token })
    expect(res.statusCode).toBe(409)
    expect(db.tables.plans).toHaveLength(1)
  })
})

describe('Avis', () => {
  let artworkId
  beforeEach(async () => {
    artworkId = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: { title: 'Toile', price: 1000, currency: 'XOF', for_sale: true } })).body.data.id
    await call({ method: 'PUT', url: `/api/artworks/${artworkId}/approve`, token: admin.token, body: { status: 'approved' } })
  })

  it('un curateur note une œuvre ; son second avis remplace le premier', async () => {
    const first = await call({ method: 'POST', url: '/api/review', token: curator.token, body: { artwork_id: artworkId, rating: 4, comment: 'Belle <b>pièce</b>' } })
    expect(first.statusCode).toBe(201)
    expect(first.body).toMatchObject({ id: expect.any(String), rating: 4, comment: 'Belle pièce' })
    const again = await call({ method: 'POST', url: '/api/review', token: curator.token, body: { artwork_id: artworkId, rating: 5 } })
    expect(again.statusCode).toBe(200)
    await call({ method: 'POST', url: '/api/review', token: advisor.token, body: { artwork_id: artworkId, rating: 3, comment: 'Correct' } })
    const list = await call({ url: `/api/review/artwork/${artworkId}` })
    expect(list.body).toHaveLength(2)
    expect(list.body.map((r) => r.rating).sort()).toEqual([3, 5])
    expect(list.body.every((r) => 'authorName' in r)).toBe(true)
  })

  it('refuse les rôles non professionnels, notes invalides et œuvres non publiées', async () => {
    const post = (token, body) => call({ method: 'POST', url: '/api/review', token, body })
    expect((await post(buyer.token, { artwork_id: artworkId, rating: 5 })).statusCode).toBe(403)
    expect((await post(artist.token, { artwork_id: artworkId, rating: 5 })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/review', body: { artwork_id: artworkId, rating: 5 } })).statusCode).toBe(401)
    for (const rating of [0, 6, 2.5, 'x']) expect((await post(curator.token, { artwork_id: artworkId, rating })).statusCode).toBe(400)
    expect((await post(curator.token, { rating: 4 })).statusCode).toBe(400)
    const pending = (await call({ method: 'POST', url: '/api/artworks', token: artist.token, body: { title: 'Brouillon' } })).body.data.id
    expect((await post(curator.token, { artwork_id: pending, rating: 4 })).statusCode).toBe(404)
    expect((await call({ url: `/api/review/artwork/${pending}` })).statusCode).toBe(404)
  })

  it('liste vide = tableau vide (pas une erreur)', async () => {
    const res = await call({ url: `/api/review/artwork/${artworkId}` })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('Blog', () => {
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
  const form = (fields, file) => {
    const boundary = '----kcbblog'
    const parts = Object.entries(fields).map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
    let body = Buffer.from(parts.join(''))
    if (file) {
      body = Buffer.concat([body, Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.content, Buffer.from('\r\n')])
    }
    return { body: Buffer.concat([body, Buffer.from(`--${boundary}--\r\n`)]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
  }
  const article = (over = {}) => ({ title: 'Les masques Baoulé', excerpt: 'Histoire et usages', content: '<p>Texte <script>alert(1)</script><strong>fort</strong></p>', tags: 'art,masque', ...over })
  const create = (fields, file, token = admin.token) => call({ method: 'POST', url: '/api/blog', token, ...form(fields, file) })

  it('crée un article avec image, contenu assaini, publié par défaut', async () => {
    const res = await create(article(), { name: 'cover.png', type: 'image/png', content: PNG })
    expect(res.statusCode).toBe(201)
    expect(res.body.data).toMatchObject({ status: 'published', title: 'Les masques Baoulé', tags: ['art', 'masque'], image: expect.stringMatching(/^https:/), authorId: admin.id, _id: expect.any(String) })
    expect(res.body.data.content).toBe('<p>Texte alert(1)<strong>fort</strong></p>')
    const published = (await call({ url: '/api/blog/published' })).body.data
    expect(published).toHaveLength(1)
  })

  it('réservé à l’admin ; validations (titre, extrait, tags, image)', async () => {
    expect((await create(article(), null, artist.token)).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: '/api/blog', ...form(article()) })).statusCode).toBe(401)
    expect((await create(article({ title: 'abc' }))).statusCode).toBe(400)
    expect((await create(article({ excerpt: 'ab' }))).statusCode).toBe(400)
    expect((await create(article({ tags: 'a,b,c,d,e,f' }))).statusCode).toBe(400)
    expect((await create(article({ tags: 'un-mot-beaucoup-trop-long' }))).statusCode).toBe(400)
    expect((await create({ title: 'Titre valide', excerpt: 'Extrait valide' })).statusCode).toBe(400) // sans contenu
    expect((await create(article(), { name: 'x.svg', type: 'image/svg+xml', content: Buffer.from('<svg/>') })).statusCode).toBe(400)
    expect((await create(article(), { name: 'big.png', type: 'image/png', content: Buffer.alloc(5 * 1024 * 1024 + 1) })).statusCode).toBe(400)
    expect(db.tables.blog_posts ?? []).toHaveLength(0)
  })

  it('cycle de vie : archiver, publier, modifier, supprimer', async () => {
    const id = (await create(article())).body.data.id
    expect((await call({ method: 'POST', url: `/api/blog/archive/${id}`, token: artist.token })).statusCode).toBe(403)
    expect((await call({ method: 'POST', url: `/api/blog/archive/${id}`, token: admin.token })).body.data.status).toBe('archived')
    expect((await call({ url: '/api/blog/published' })).body.data).toHaveLength(0)
    expect((await call({ url: '/api/blog/archived', token: admin.token })).body.data).toHaveLength(1)
    expect((await call({ url: '/api/blog/archived', token: artist.token })).statusCode).toBe(403)
    expect((await call({ url: `/api/blog/${id}` })).statusCode).toBe(404) // archivé : caché au public
    expect((await call({ url: `/api/blog/${id}`, token: admin.token })).statusCode).toBe(200)
    expect((await call({ method: 'POST', url: `/api/blog/publish/${id}`, token: admin.token })).body.data.status).toBe('published')

    const edited = await call({ method: 'PUT', url: `/api/blog/${id}`, token: admin.token, ...form({ title: 'Titre corrigé' }) })
    expect(edited.body.data.title).toBe('Titre corrigé')
    expect((await call({ method: 'PUT', url: `/api/blog/${id}`, token: artist.token, ...form({ title: 'Titre piraté' }) })).statusCode).toBe(403)
    expect((await call({ method: 'DELETE', url: `/api/blog/${id}`, token: artist.token })).statusCode).toBe(403)
    expect((await call({ method: 'DELETE', url: `/api/blog/${id}`, token: admin.token })).statusCode).toBe(200)
    expect((await call({ url: `/api/blog/${id}` })).statusCode).toBe(404)
  })

  it('lecture publique : compteur de visites et commentaires', async () => {
    const id = (await create(article())).body.data.id
    await call({ url: `/api/blog/${id}` })
    const read = await call({ url: `/api/blog/${id}` })
    expect(read.body.data).toMatchObject({ visited: 2, comments: [] })
  })

  it('commentaires : connecté, texte brut, article publié ; suppression par l’admin', async () => {
    const id = (await create(article())).body.data.id
    const post = (token, body) => call({ method: 'POST', url: `/api/blog/comment/${id}`, token, body })
    expect((await post(undefined, { content: 'Bravo' })).statusCode).toBe(401)
    expect((await post(buyer.token, { content: '   ' })).statusCode).toBe(400)
    expect((await post(buyer.token, { content: 'x'.repeat(2001) })).statusCode).toBe(400)
    const ok = await post(buyer.token, { authorId: 'forgé', content: 'Superbe <img src=x onerror=alert(1)> article' })
    expect(ok.statusCode).toBe(201)
    expect(ok.body.data.comments).toHaveLength(1)
    expect(ok.body.data.comments[0]).toMatchObject({ authorId: buyer.id, content: 'Superbe  article' }) // identité du jeton, HTML retiré
    const commentId = ok.body.data.comments[0].id
    expect((await call({ method: 'DELETE', url: `/api/blog/comment/${commentId}`, token: buyer.token })).statusCode).toBe(403)
    expect((await call({ method: 'DELETE', url: `/api/blog/comment/${commentId}`, token: admin.token })).statusCode).toBe(200)
    await call({ method: 'POST', url: `/api/blog/archive/${id}`, token: admin.token })
    expect((await post(buyer.token, { content: 'Trop tard' })).statusCode).toBe(404)
  })
})
