// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi } from './helpers'
import { makeReq, makeRes } from './fakeSupabase'

// Session et stockage simulés : on exécute le VRAI code front de soumission (src/api/useArtworks.js)
const session = { token: '', userId: '' }
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: session.token, user: { id: session.userId } } } }) } },
}))
vi.mock('../../lib/storage', () => ({
  uploadArtworkImage: async (userId, file) => ({ url: `https://storage.test/artworks/${userId}/${file.name}` }),
  uploadFile: async ({ path }) => ({ url: `https://storage.test/${path}` }),
}))

let db, call, artist, handlerCall, submitArtwork, updateArtwork, buildArtworkFormData

beforeEach(async () => {
  vi.stubEnv('VITE_API_URL', '/api')
  vi.stubEnv('VITE_API_KEY', 'test-key')
  ;({ db, call: handlerCall } = await loadApi())
  artist = db.addUser({ role: 'artist', email: 'adama@test.local', name: 'adama mbow' })
  session.token = artist.token
  session.userId = artist.id
  // Le front appelle fetch('/api/…') : on le route vers le vrai handler
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const res = makeRes()
    const { default: handler } = await import('../../../api/[...path].js')
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]))
    await handler(makeReq({ method: init.method || 'GET', url: String(url), token: headers.authorization?.replace(/^Bearer\s+/i, ''), body: init.body ? JSON.parse(init.body) : undefined }), res)
    return { ok: res.statusCode < 400, status: res.statusCode, json: async () => res.body }
  }))
  ;({ submitArtwork, updateArtwork } = await import('../../api/useArtworks.js'))
  ;({ buildArtworkFormData } = await import('../../components/artworks/submit/buildArtworkFormData.js'))
  void handlerCall
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

/** État du formulaire de soumission (SubmitArtwork.jsx), valeurs de la capture d'écran. */
const formState = (over = {}) => ({
  title: 'Labyrinthe des sens', description: 'Labyrinthe des sens', image: new File([new Uint8Array([1, 2, 3])], 'labyrinthe.jpg', { type: 'image/jpeg' }),
  tags: ['Zéro neuf'], price: '500000', forSale: true, auctionStatus: 'not_for_auction', currency: 'XOF',
  category: '', categoryId: '', artist: 'adama mbow', artistId: 'uuid-profil', userId: 'uuid-user', forBid: false,
  height: '130', width: '80', weight: '3', medium: '', condition: '', provenance: '', availabilityStatus: 'available',
  tag: '', step: 3, loading: false, show: 'data:image/jpeg;base64,xxx', error: '',
  ...over,
})

describe('Soumission d’une œuvre par un artiste (formulaire réel -> API réelle)', () => {
  it('le formulaire de la capture est accepté et enregistré en « pending »', async () => {
    const result = await submitArtwork(buildArtworkFormData(formState()))
    expect(result.error, result.error).toBeUndefined()
    expect(result).toMatchObject({
      id: expect.any(String), title: 'Labyrinthe des sens', price: 500000, currency: 'XOF', status: 'pending',
      user_id: artist.id, for_sale: true, for_bid: false, auction_status: 'not_for_auction', availability_status: 'available',
      height: 130, width: 80, weight: 3, tags: ['Zéro neuf'], image: `https://storage.test/artworks/${artist.id}/labyrinthe.jpg`,
    })
    expect(result.condition ?? null).toBeNull()
    expect(result.category_id ?? null).toBeNull()
  })

  it('même avec les anciens champs en camelCase et les chaînes vides (anciens formulaires déjà ouverts)', async () => {
    // Ce que l'ancien Step4 envoyait : tout le formulaire, valeurs vides et identités comprises
    const legacy = new FormData()
    for (const [k, v] of Object.entries(formState())) {
      if (['step', 'tag', 'loading', 'show', 'error'].includes(k)) continue
      legacy.append(k, k === 'tags' ? JSON.stringify(v) : v)
    }
    const result = await submitArtwork(legacy)
    expect(result.error, result.error).toBeUndefined()
    expect(result).toMatchObject({ status: 'pending', user_id: artist.id, for_sale: true, tags: ['Zéro neuf'] })
    expect(result.user_id).not.toBe('uuid-user') // l'identité vient du jeton, jamais du formulaire
  })

  it('mots-clés : JSON, liste séparée par des virgules ou absents', async () => {
    const ok = async (tags) => (await submitArtwork(buildArtworkFormData(formState({ tags }))))
    expect((await ok(['a', 'b'])).tags).toEqual(['a', 'b'])
    const csv = new FormData(); csv.append('title', 'Titre valide'); csv.append('tags', 'bois, masque ,')
    expect((await submitArtwork(csv)).tags).toEqual(['bois', 'masque'])
    expect((await ok([])).tags ?? []).toEqual([])
  })

  it('titre numérique (« 2024 ») : conservé comme texte', async () => {
    const result = await submitArtwork(buildArtworkFormData(formState({ title: '2024', description: '12' })))
    expect(result.error, result.error).toBeUndefined()
    expect(result).toMatchObject({ title: '2024', description: '12' })
  })

  it('condition et catégorie valides sont conservées ; valeurs invalides refusées avec un message clair', async () => {
    const category = { id: '00000000-0000-4000-8000-0000000000c1' }
    const good = await submitArtwork(buildArtworkFormData(formState({ condition: 'very_good', categoryId: category.id, category: 'Sculpture' })))
    expect(good).toMatchObject({ condition: 'very_good', category_id: category.id, category: 'Sculpture' })
    const badCondition = await submitArtwork(buildArtworkFormData(formState({ condition: 'tres bon' })))
    expect(badCondition.error).toMatch(/condition/i)
    const badCategory = await submitArtwork(buildArtworkFormData(formState({ categoryId: 'pas-un-uuid' })))
    expect(badCategory.error).toMatch(/category/i)
  })

  it('prix négatif, devise inconnue, image non https : refusés', async () => {
    expect((await submitArtwork(buildArtworkFormData(formState({ price: '-5' })))).error).toMatch(/price/i)
    expect((await submitArtwork(buildArtworkFormData(formState({ currency: 'GBP' })))).error).toMatch(/currency/i)
    const direct = await handlerCall({ method: 'POST', url: '/api/artworks', token: artist.token, body: { title: 'Titre valide', image: 'javascript:alert(1)' } })
    expect(direct.statusCode).toBe(400)
    expect(JSON.stringify(direct.body)).toMatch(/image/i)
  })

  it('titre obligatoire', async () => {
    const result = await submitArtwork(buildArtworkFormData(formState({ title: '' })))
    expect(result.error).toMatch(/title/i)
  })

  it('une œuvre ne peut pas s’attribuer un statut, un identifiant KCB ni un autre propriétaire', async () => {
    const body = { title: 'Titre valide', status: 'approved', kucibok_id: 'KCB-HACK0001', user_id: 'autre', artist_id: 'autre', sold: true, featured: true }
    const res = await handlerCall({ method: 'POST', url: '/api/artworks', token: artist.token, body })
    expect(res.statusCode).toBe(201)
    expect(res.body.data).toMatchObject({ status: 'pending', user_id: artist.id })
    expect(res.body.data.kucibok_id).toBeUndefined()
    expect(res.body.data.sold).toBeUndefined()
    expect(res.body.data.featured).toBeUndefined()
  })

  it('modification (updateArtwork) : champs convertis, chaînes vides = effacement, pas de colonne inconnue', async () => {
    const created = await submitArtwork(buildArtworkFormData(formState({ condition: 'good' })))
    const form = new FormData()
    form.append('title', 'Nouveau titre'); form.append('price', '750000'); form.append('for_sale', 'false')
    form.append('condition', ''); form.append('inconnu', 'x')
    const updated = await updateArtwork(created.id, form)
    expect(updated.error, updated.error).toBeUndefined()
    expect(updated).toMatchObject({ title: 'Nouveau titre', price: 750000, for_sale: false })
    expect(updated.condition ?? null).toBeNull()
    expect(updated.inconnu).toBeUndefined()
  })
})
