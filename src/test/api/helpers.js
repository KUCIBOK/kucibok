import { vi } from 'vitest'
import { createFakeDb, makeReq, makeRes } from './fakeSupabase'

/** Charge le vrai handler avec un faux Supabase ; `fetchMock` simule PayDunya. */
export async function loadApi() {
  vi.resetModules()
  const db = createFakeDb()
  vi.doMock('@supabase/supabase-js', () => ({ createClient: () => db.client }))
  process.env.SUPABASE_URL = 'http://fake'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
  process.env.API_KEY = 'test-key'
  process.env.CORS_ORIGIN = 'https://kucibok.test'
  process.env.PAYDUNYA_MODE = 'test'
  const { default: handler } = await import('../../../api/[...path].js')
  const call = async (opts) => {
    const res = makeRes()
    await handler(makeReq(opts), res)
    return res
  }
  return { db, call }
}

/** Simule PayDunya : création de facture puis confirmation. */
export function mockPayDunya() {
  const invoices = {}
  let n = 0
  const fetchMock = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.includes('/checkout-invoice/create')) {
      n += 1
      const token = `test_invoice_${n}`
      invoices[token] = { status: 'pending', body: JSON.parse(init.body) }
      return { ok: true, json: async () => ({ response_code: '00', response_text: `https://pay.test/${token}`, token }) }
    }
    if (u.includes('/checkout-invoice/confirm/')) {
      const token = decodeURIComponent(u.split('/confirm/')[1])
      return { ok: true, json: async () => ({ status: invoices[token]?.status || 'pending' }) }
    }
    // autres appels sortants (e-mails Resend…) : succès muet
    return { ok: true, json: async () => ({ id: 'mock' }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  return { invoices, fetchMock, pay: (token) => { invoices[token].status = 'completed' } }
}
