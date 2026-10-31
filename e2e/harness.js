/**
 * Harnais E2E : sert le front buildé, lance Chromium et répond aux appels réseau :
 *  - /api/*                      -> le VRAI handler api/[...path].js (faux Supabase en mémoire)
 *  - https://fake.supabase.co/*  -> mock minimal de Supabase Auth / REST
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { vi } from 'vitest'
import { createFakeDb, makeReq, makeRes } from '../src/test/api/fakeSupabase.js'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

export const SUPABASE_HOST = 'https://fake.supabase.co'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' }

export async function startHarness({ distDir }) {
  vi.resetModules()
  const db = createFakeDb()
  vi.doMock('@supabase/supabase-js', () => ({ createClient: () => db.client }))
  process.env.SUPABASE_URL = 'http://fake'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
  process.env.API_KEY = 'test-key'
  process.env.CORS_ORIGIN = 'http://localhost'
  const { default: handler } = await import('../api/[...path].js')

  // Serveur statique avec repli SPA
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.join(distDir, urlPath)
    if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html')
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`

  const browser = await chromium.launch()
  const apiLog = []

  const session = (u) => ({
    access_token: u.token, refresh_token: `r-${u.id}`, token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: db.tables.users.find((x) => x.id === u.id).email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: { role: db.tables.users.find((x) => x.id === u.id).role, name: 'Test' }, created_at: new Date().toISOString() },
  })

  async function newPage(user) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await context.newPage()
    const problems = { pageErrors: [], consoleErrors: [], apiErrors: [] }
    page.on('pageerror', (e) => problems.pageErrors.push(String(e.message).slice(0, 300)))
    page.on('console', (m) => { if (m.type() === 'error') problems.consoleErrors.push(m.text().slice(0, 300)) })

    await context.route('**/*', async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      if (url.origin === SUPABASE_HOST) {
        const u = user
        if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: session(u).user })
        if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session(u) })
        if (url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' })
        if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: [] })
        return route.fulfill({ json: {} })
      }
      if (url.origin === origin && url.pathname.startsWith('/api/')) {
        const body = req.postData() ? (() => { try { return JSON.parse(req.postData()) } catch { return req.postData() } })() : undefined
        const r = makeRes()
        await handler(makeReq({ method: req.method(), url: url.pathname + url.search, token: (req.headers().authorization || '').replace(/^Bearer\s+/i, '') || undefined, body, headers: { 'kcb-api-key': req.headers()['kcb-api-key'] } }), r)
        apiLog.push({ method: req.method(), path: url.pathname, status: r.statusCode })
        if (r.statusCode >= 400) problems.apiErrors.push(`${req.method()} ${url.pathname} -> ${r.statusCode} ${JSON.stringify(r.body)?.slice(0, 120)}`)
        const isJson = typeof r.body === 'object'
        return route.fulfill({ status: r.statusCode, contentType: isJson ? 'application/json' : 'text/plain', body: isJson ? JSON.stringify(r.body) : String(r.body ?? '') })
      }
      return route.continue()
    })

    if (user) {
      await context.addInitScript((s) => {
        localStorage.setItem('sb-fake-auth-token', JSON.stringify(s))
        localStorage.setItem('kcb_analytics_consent', 'false')
      }, session(user))
    }
    return { page, context, problems }
  }

  return { db, origin, newPage, apiLog, close: async () => { await browser.close(); server.close() } }
}
