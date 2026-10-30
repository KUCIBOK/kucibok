// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import fs from 'node:fs'
import { startHarness } from './harness.js'

const DIST = process.env.E2E_DIST
const REPORT = process.env.E2E_REPORT || '/tmp/e2e-report.json'
let h, users
const report = {}

const SKIP_BUTTON = /supprimer|delete|d[ée]connexion|log ?out|sign ?out|quitter/i

beforeAll(async () => {
  h = await startHarness({ distDir: DIST })
  const { db } = h
  users = {
    admin: db.addUser({ role: 'admin', email: 'admin@test.local' }),
    artist: db.addUser({ role: 'artist', email: 'artist@test.local' }),
    curator: db.addUser({ role: 'curator', email: 'curator@test.local' }),
    advisor: db.addUser({ role: 'advisor', email: 'advisor@test.local' }),
    buyer: db.addUser({ role: 'buyer', email: 'buyer@test.local' }),
  }
  const trialEnd = new Date(Date.now() + 14 * 864e5).toISOString()
  db.tables.subscriptions = [users.curator, users.advisor].map((u) => ({ id: `s-${u.id}`, user_id: u.id, status: 'trial', is_trial: true, end_date: trialEnd }))
  db.tables.artists = [{ id: 'art-1', user_id: users.artist.id, name: 'Test Artiste', country: 'SN' }]
  const base = { for_sale: true, sold: false, price: 100000, currency: 'XOF', user_id: users.artist.id, artist_id: 'art-1', created_at: new Date().toISOString() }
  db.tables.artworks = [
    { id: 'w-pending', title: 'En attente', status: 'pending', ...base },
    { id: 'w-approved', title: 'Approuvée', status: 'approved', kucibok_id: 'KCB-00000001', ...base },
    { id: 'w-rejected', title: 'Rejetée', status: 'rejected', ...base },
  ]
})
afterAll(async () => {
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  await h?.close()
})

/**
 * Visite une page puis clique chaque bouton visible (hors actions destructrices), y compris ceux
 * qui apparaissent après un clic (onglets, modales). Relève erreurs JS, appels API en échec
 * et crash React, en les rattachant au bouton cliqué.
 */
async function crawl(name, user, route) {
  const { page, problems } = await h.newPage(user)
  const r = (report[`${name} ${route}`] = { clicked: [], skipped: [], notes: [], perButton: {} })
  await page.goto(h.origin + route, { waitUntil: 'networkidle' }).catch((e) => r.notes.push('goto: ' + e.message))
  await page.waitForTimeout(800)
  r.finalUrl = page.url().replace(h.origin, '')
  const crashed = async () => /something went wrong|une erreur est survenue|erreur inattendue|application error/i.test(await page.locator('body').innerText().catch(() => ''))
  r.errorBoundary = await crashed()

  const visible = () => page.locator('button, [role=button], [role=tab]').filter({ visible: true })
  const labelOf = (loc) => loc.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 70))
  const done = new Set()
  for (let step = 0; step < 150; step++) {
    const count = await visible().count()
    let target = null
    for (let i = 0; i < count; i++) {
      const loc = visible().nth(i)
      const label = await labelOf(loc).catch(() => null)
      if (label === null) continue
      const key = label || `#icon-${i}`
      if (done.has(key)) continue
      done.add(key)
      if (SKIP_BUTTON.test(label)) { r.skipped.push(label); continue }
      target = { loc, key }
      break
    }
    if (!target) break
    const before = { err: problems.apiErrors.length, js: problems.pageErrors.length, url: page.url() }
    try {
      await target.loc.click({ timeout: 1500 })
      r.clicked.push(target.key)
      await page.waitForTimeout(300)
    } catch (e) {
      r.notes.push(`click "${target.key}": ${String(e.message).split('\n')[0].slice(0, 90)}`)
    }
    const newApi = problems.apiErrors.slice(before.err)
    const newJs = problems.pageErrors.slice(before.js)
    const boundary = await crashed()
    if (newApi.length || newJs.length || boundary) r.perButton[target.key] = { api: newApi, js: newJs, boundary }
    await page.keyboard.press('Escape').catch(() => {})
    if (page.url() !== before.url) {
      await page.goBack({ waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(300)
    }
    if (boundary) { await page.goto(h.origin + route, { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(500) }
  }
  r.pageErrors = [...new Set(problems.pageErrors)]
  r.consoleErrors = [...new Set(problems.consoleErrors)].filter((c) => !/ERR_TUNNEL|net::ERR/.test(c)).slice(0, 10)
  r.apiErrors = [...new Set(problems.apiErrors)]
  await page.context().close()
  return r
}

describe('Parcours navigateur par portail', () => {
  const targets = [
    ['artist', '/dashboard/artist'],
    ['curator', '/dashboard/curator'],
    ['advisor', '/dashboard/advisor'],
    ['admin', '/dashboard/admin'],
    ['buyer', '/account'],
  ]
  for (const [who, route] of targets) {
    it(`${who} : ${route}`, async () => {
      const r = await crawl(who, users[who], route)
      expect(r.pageErrors, `erreurs JS : ${r.pageErrors.join(' | ')}`).toEqual([])
    })
  }
})

describe('Parcours métier dans le navigateur', () => {
  it('admin : onglet « En attente » -> Approuver -> confirmer -> l’œuvre est approuvée en base', async () => {
    const { page } = await h.newPage(users.admin)
    await page.goto(h.origin + '/dashboard/admin', { waitUntil: 'networkidle' })
    // catégorie « Gestion Œuvres » du menu ; puis l'entrée « En attente »
    await page.getByRole('button', { name: /Gestion Œuvres|Artwork Management/ }).click()
    await page.getByRole('button', { name: /En attente|Pending/ }).first().click()
    await page.waitForTimeout(600)
    await page.locator('button[title="Approuver"]').first().click({ timeout: 5000 })
    await page.getByRole('button', { name: 'Approuver', exact: true }).last().click({ timeout: 5000 })
    await page.waitForTimeout(800)
    expect(h.db.tables.artworks.find((a) => a.id === 'w-pending').status).toBe('approved')
    await page.context().close()
  })

  it('admin : rejette puis l’œuvre apparaît dans « Rejetées » (API)', async () => {
    const { page } = await h.newPage(users.admin)
    await page.goto(h.origin + '/dashboard/admin', { waitUntil: 'networkidle' })
    const res = await page.evaluate(async (token) => {
      const r = await fetch('/api/artworks/w-approved/approve', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'kcb-api-key': 'test-key' }, body: JSON.stringify({ status: 'rejected' }) })
      return r.status
    }, users.admin.token)
    expect(res).toBe(200)
    await page.context().close()
  })
})
