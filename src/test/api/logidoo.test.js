// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadApi } from './helpers'
import { logidooConfig, logidooRequest, createLogidooClient, describeShape, LogidooError } from '../../../api/_modules/logidoo.js'

const TOKEN = 'tok_SECRET_123'
const STAGING = 'https://staging-expedition.logidoo.co/api/v1'
const PRODUCTION = 'https://expedition.logidoo.co/api/v1'

/** fetch simulé : répond selon un tableau de [motif d'URL, réponse]. */
const stubFetch = (routes) => {
  const calls = []
  const fn = vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body })
    const hit = routes.find(([pattern]) => String(url).includes(pattern))
    const [, status = 200, body = {}] = hit || []
    if (typeof body === 'function') return body(url, init)
    return { ok: status < 400, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }
  })
  vi.stubGlobal('fetch', fn)
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  for (const k of ['LOGIDOO_API_KEY', 'LOGIDOO_ENV', 'LOGIDOO_WEBHOOK_SECRET', 'LOGIDOO_BASE_URL']) delete process.env[k]
})

describe('Configuration Logidoo', () => {
  it('non configuré sans jeton ; staging par défaut ; production seulement si demandé', () => {
    expect(logidooConfig({}).configured).toBe(false)
    expect(logidooConfig({ LOGIDOO_API_KEY: '  ' }).configured).toBe(false)
    expect(logidooConfig({ LOGIDOO_API_KEY: TOKEN })).toMatchObject({ configured: true, mode: 'staging', baseUrl: STAGING })
    for (const env of ['sandbox', 'staging', '', 'prod', 'live']) {
      expect(logidooConfig({ LOGIDOO_API_KEY: TOKEN, LOGIDOO_ENV: env }).mode, env).toBe('staging')
    }
    expect(logidooConfig({ LOGIDOO_API_KEY: TOKEN, LOGIDOO_ENV: ' Production ' })).toMatchObject({ mode: 'production', baseUrl: PRODUCTION })
    expect(logidooConfig({ LOGIDOO_API_KEY: TOKEN, LOGIDOO_BASE_URL: 'http://localhost:9/api/v1/' }).baseUrl).toBe('http://localhost:9/api/v1')
  })
})

describe('Client Logidoo', () => {
  const cfg = logidooConfig({ LOGIDOO_API_KEY: TOKEN })

  it('envoie le jeton Bearer, le paramètre countryCode et appelle le staging', async () => {
    const calls = stubFetch([['/node', 200, [{ id: 1 }]]])
    await createLogidooClient(cfg).listNodes('SN')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${STAGING}/node?countryCode=SN`)
    expect(calls[0].headers).toMatchObject({ Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' })
    expect(calls[0].headers['Content-Type']).toBeUndefined() // pas de corps sur un GET
  })

  it('utilise les chemins documentés avec encodage des identifiants', async () => {
    const calls = stubFetch([['', 200, {}]])
    const client = createLogidooClient(cfg)
    await client.getTracking('KCB 12/3')
    await client.getExpedition('abc')
    await client.cancelExpedition('abc')
    await client.getNode(7)
    await client.listCarriers()
    await client.listOperations()
    expect(calls.map((c) => `${c.method} ${c.url.replace(STAGING, '')}`)).toEqual([
      'GET /expedition-tracking/KCB%2012%2F3',
      'GET /expedition/abc',
      'DELETE /expedition/abc',
      'GET /node/7',
      'GET /carrier',
      'GET /operations',
    ])
  })

  it('crée une expédition avec un corps JSON', async () => {
    const calls = stubFetch([['/expedition', 201, { trackingNumber: 'T1' }]])
    const payload = { totalWeight: 3, transportMode: 'AIR', transportType: 'EXPRESS' }
    const out = await createLogidooClient(cfg).createExpedition(payload)
    expect(out).toEqual({ trackingNumber: 'T1' })
    expect(calls[0]).toMatchObject({ method: 'POST', url: `${STAGING}/expedition` })
    expect(calls[0].headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(calls[0].body)).toEqual(payload)
  })

  it('sans jeton : erreur claire et aucun appel réseau', async () => {
    const calls = stubFetch([['', 200, {}]])
    await expect(createLogidooClient(logidooConfig({})).listNodes('SN')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    expect(calls).toHaveLength(0)
  })

  it('erreurs HTTP, réseau et délai dépassé ; le jeton ne fuit jamais', async () => {
    stubFetch([['/node', 401, { message: 'Unauthorized' }]])
    const unauthorized = await logidooRequest(cfg, 'GET', '/node').catch((e) => e)
    expect(unauthorized).toBeInstanceOf(LogidooError)
    expect(unauthorized).toMatchObject({ code: 'UNAUTHORIZED', status: 401 })

    stubFetch([['/node', 404, 'introuvable']])
    expect(await logidooRequest(cfg, 'GET', '/node').catch((e) => e)).toMatchObject({ code: 'NOT_FOUND' })

    stubFetch([['/node', 500, 'x'.repeat(5000)]])
    const server = await logidooRequest(cfg, 'GET', '/node').catch((e) => e)
    expect(server.code).toBe('HTTP_ERROR')
    expect(server.body.length).toBeLessThan(1100) // corps tronqué

    vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }) }))
    const network = await logidooRequest(cfg, 'GET', '/node').catch((e) => e)
    expect(network).toMatchObject({ code: 'NETWORK' })
    expect(network.message).toMatch(/ENOTFOUND/)

    vi.stubGlobal('fetch', vi.fn((url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))))
    expect(await logidooRequest(cfg, 'GET', '/node', { timeoutMs: 20 }).catch((e) => e)).toMatchObject({ code: 'TIMEOUT' })

    for (const e of [unauthorized, server, network]) expect(JSON.stringify([e.message, e.body])).not.toContain(TOKEN)
  })
})

describe('describeShape : forme sans données personnelles', () => {
  it('masque les valeurs, garde le vocabulaire de statut', () => {
    const shape = describeShape({
      trackingNumber: 'KCB-123', receiver: { fullName: 'Awa Diop', phone: '+221770000000' }, cost: 42000,
      activityLog: [{ status: 'IN_TRANSIT', date: '2026-10-01', details: 'Colis chez Awa Diop' }, { status: 'DELIVERED' }],
      transportMode: 'AIR',
    })
    expect(shape.cost).toBe('number')
    expect(shape.activityLog).toEqual({ type: 'array', length: 2, item: { status: { type: 'string', value: 'IN_TRANSIT' }, date: 'string', details: 'string' } })
    expect(shape.transportMode).toEqual({ type: 'string', value: 'AIR' })
    expect(JSON.stringify(shape)).not.toMatch(/Awa|Diop|770000000|KCB-123/)
  })
})

describe('Routes /api/logistics/logidoo', () => {
  let db, call, admin, artist
  beforeEach(async () => {
    ;({ db, call } = await loadApi())
    admin = db.addUser({ role: 'admin' })
    artist = db.addUser({ role: 'artist' })
  })

  it('status : réservé à l’admin, sans jeton configuré', async () => {
    expect((await call({ url: '/api/logistics/logidoo/status' })).statusCode).toBe(401)
    expect((await call({ url: '/api/logistics/logidoo/status', token: artist.token })).statusCode).toBe(403)
    const res = await call({ url: '/api/logistics/logidoo/status?check=1', token: admin.token })
    expect(res.body).toMatchObject({ configured: false, environment: 'staging', baseUrl: STAGING, webhook: { configured: false } })
    expect(res.body.check).toMatchObject({ ok: false, status: 503 })
  })

  it('status sans check : aucun appel Logidoo ; avec check=1 : appel authentifié sur le staging', async () => {
    process.env.LOGIDOO_API_KEY = TOKEN
    const calls = stubFetch([['/node', 200, []]])
    const plain = await call({ url: '/api/logistics/logidoo/status', token: admin.token })
    expect(plain.body).toMatchObject({ configured: true, environment: 'staging' })
    expect(calls).toHaveLength(0)

    const checked = await call({ url: '/api/logistics/logidoo/status?check=1&country=CI', token: admin.token })
    expect(checked.body.check).toMatchObject({ ok: true })
    expect(calls[0].url).toBe(`${STAGING}/node?countryCode=CI`)
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.stringify([plain.body, checked.body])).not.toContain(TOKEN)
  })

  it('status : jeton refusé -> message actionnable, sans le jeton', async () => {
    process.env.LOGIDOO_API_KEY = TOKEN
    stubFetch([['/node', 401, { message: 'bad token' }]])
    const res = await call({ url: '/api/logistics/logidoo/status?check=1', token: admin.token })
    expect(res.body.check).toMatchObject({ ok: false, httpStatus: 401, status: 502 })
    expect(res.body.check.error).toMatch(/LOGIDOO_API_KEY/)
    expect(JSON.stringify(res.body)).not.toContain(TOKEN)
  })

  it('status en production quand LOGIDOO_ENV=production', async () => {
    process.env.LOGIDOO_API_KEY = TOKEN
    process.env.LOGIDOO_ENV = 'production'
    const calls = stubFetch([['/node', 200, []]])
    const res = await call({ url: '/api/logistics/logidoo/status?check=1', token: admin.token })
    expect(res.body.environment).toBe('production')
    expect(calls[0].url.startsWith(`${PRODUCTION}/node`)).toBe(true)
  })

  it('probe : renvoie les formes, jamais les valeurs personnelles', async () => {
    process.env.LOGIDOO_API_KEY = TOKEN
    const calls = stubFetch([
      ['/node', 200, [{ id: 3, name: 'Dépôt Dakar Plateau', address: '12 rue Awa Diop', countryCode: 'SN' }]],
      ['/carrier', 200, [{ id: 1, name: 'TransAfrik' }]],
      ['/expedition-tracking/', 200, { activityLog: [{ status: 'PICKED_UP', date: 'd', details: 'Chez Awa Diop' }] }],
      ['/expedition', 200, { data: [{ id: 'e1', receiver: { fullName: 'Awa Diop', phone: '+221770000000' }, status: 'CREATED' }] }],
      ['/operations', 200, []],
    ])
    expect((await call({ url: '/api/logistics/logidoo/probe', token: artist.token })).statusCode).toBe(403)
    const res = await call({ url: '/api/logistics/logidoo/probe?country=sn&trackingNumber=T-1', token: admin.token })
    expect(res.statusCode).toBe(200)
    expect(Object.keys(res.body.results)).toEqual(['GET /node?countryCode=SN', 'GET /carrier', 'GET /expedition', 'GET /operations', 'GET /expedition-tracking/{trackingNumber}'])
    expect(res.body.results['GET /expedition-tracking/{trackingNumber}'].shape.activityLog.item.status).toEqual({ type: 'string', value: 'PICKED_UP' })
    expect(res.body.results['GET /expedition'].shape.data.item.status).toEqual({ type: 'string', value: 'CREATED' })
    expect(JSON.stringify(res.body)).not.toMatch(/Awa|Diop|770000000|Dakar Plateau|TransAfrik/)
    expect(calls.every((c) => c.method === 'GET')).toBe(true) // diagnostic en lecture seule
  })

  it('probe : un endpoint en échec n’empêche pas les autres', async () => {
    process.env.LOGIDOO_API_KEY = TOKEN
    stubFetch([['/carrier', 500, 'boom'], ['', 200, []]])
    const res = await call({ url: '/api/logistics/logidoo/probe', token: admin.token })
    expect(res.body.results['GET /carrier']).toMatchObject({ ok: false, httpStatus: 500 })
    expect(res.body.results['GET /node?countryCode=SN'].ok).toBe(true)
  })

  it('probe sans jeton : 503 explicite', async () => {
    const res = await call({ url: '/api/logistics/logidoo/probe', token: admin.token })
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toMatch(/LOGIDOO_API_KEY/)
  })

  it('webhook : refusé sans secret configuré, avec mauvais secret, sans corps', async () => {
    const post = (qs, body) => call({ method: 'POST', url: `/api/logistics/logidoo/webhook${qs}`, body })
    expect((await post('?secret=x', { a: 1 })).statusCode).toBe(503)
    process.env.LOGIDOO_WEBHOOK_SECRET = 'bon-secret'
    expect((await post('', { a: 1 })).statusCode).toBe(401)
    expect((await post('?secret=mauvais', { a: 1 })).statusCode).toBe(401)
    expect((await post('?secret=bon-secre', { a: 1 })).statusCode).toBe(401) // longueur différente
    expect((await post('?secret=bon-secret', undefined)).statusCode).toBe(400)
    expect(db.tables.logidoo_webhook_events ?? []).toHaveLength(0)
  })

  it('webhook : conserve le payload brut et seulement les en-têtes utiles', async () => {
    process.env.LOGIDOO_WEBHOOK_SECRET = 'bon-secret'
    const payload = { operationId: 'op1', status: 'DELIVERED', anything: { nested: true } }
    const res = await call({
      method: 'POST', url: '/api/logistics/logidoo/webhook?secret=bon-secret', body: payload,
      headers: { 'content-type': 'application/json', 'x-logidoo-signature': 'sig', authorization: 'Bearer secret', cookie: 'a=b' },
    })
    expect(res.statusCode).toBe(200)
    const stored = db.tables.logidoo_webhook_events[0]
    expect(stored.payload).toEqual(payload)
    expect(stored.headers).toMatchObject({ 'content-type': 'application/json', 'x-logidoo-signature': 'sig' })
    expect(JSON.stringify(stored.headers)).not.toMatch(/authorization|cookie|Bearer/i)

    const list = await call({ url: '/api/logistics/logidoo/webhooks', token: admin.token })
    expect(list.body.events).toHaveLength(1)
    expect((await call({ url: '/api/logistics/logidoo/webhooks', token: artist.token })).statusCode).toBe(403)
    expect((await call({ url: '/api/logistics/logidoo/webhooks' })).statusCode).toBe(401)
  })

  it('webhook : table absente -> indication de la migration', async () => {
    process.env.LOGIDOO_WEBHOOK_SECRET = 'bon-secret'
    db.failTables.add('logidoo_webhook_events')
    const res = await call({ method: 'POST', url: '/api/logistics/logidoo/webhook?secret=bon-secret', body: { a: 1 } })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toMatch(/037_logidoo_webhook_events/)
  })

  it('routes non alimentées : 501 avec la raison précise', async () => {
    for (const [method, url, pattern] of [
      ['GET', '/api/logistics/zones', /zones tarifées/],
      ['POST', '/api/logistics/rates', /devis séparé/],
      ['GET', '/api/logistics/pickup-points', /\/node/],
      ['PUT', '/api/logistics/update/T1', /statuts/],
    ]) {
      const res = await call({ method, url, token: artist.token, body: {} })
      expect(res.statusCode, url).toBe(501)
      expect(res.body.error, url).toMatch(pattern)
    }
  })
})
