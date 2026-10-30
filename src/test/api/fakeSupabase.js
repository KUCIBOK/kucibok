/**
 * Faux client Supabase en mémoire pour tester le vrai handler api/[...path].js
 * sans base de données. Couvre le sous-ensemble de l'API PostgREST utilisé par le backend.
 */
// Valeurs par défaut des colonnes (DEFAULT SQL) que le faux client doit reproduire
const COLUMN_DEFAULTS = {
  logistics_alerts: { read: false, metadata: {} },
}

let counter = 0
const uuid = () => {
  counter += 1
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
}

export function createFakeDb(seed = {}) {
  const tables = {}
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }))
  const sessions = {} // token -> auth user
  const calls = []

  const table = (name) => (tables[name] ||= [])

  class Query {
    constructor(name) {
      this.name = name
      this.filters = []
      this.op = 'select'
      this.payload = null
      this.orderBy = null
      this.max = null
      this.countMode = false
    }
    select(cols) { if (this.op === 'select') this.op = 'select'; this.cols = cols; return this }
    insert(p) { this.op = 'insert'; this.payload = p; return this }
    update(p) { this.op = 'update'; this.payload = p; return this }
    upsert(p) { this.op = 'upsert'; this.payload = p; return this }
    delete() { this.op = 'delete'; return this }
    eq(k, v) { this.filters.push((r) => r[k] === v); return this }
    neq(k, v) { this.filters.push((r) => r[k] !== v); return this }
    in(k, v) { this.filters.push((r) => v.includes(r[k])); return this }
    lt(k, v) { this.filters.push((r) => r[k] != null && r[k] < v); return this }
    gt(k, v) { this.filters.push((r) => r[k] != null && r[k] > v); return this }
    gte(k, v) { this.filters.push((r) => r[k] != null && r[k] >= v); return this }
    lte(k, v) { this.filters.push((r) => r[k] != null && r[k] <= v); return this }
    is(k, v) { this.filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return this }
    not(k, op, v) {
      if (op === 'is') this.filters.push((r) => (v === null ? r[k] != null : r[k] !== v))
      else if (op === 'in') {
        const list = String(v).replace(/[()]/g, '').split(',')
        this.filters.push((r) => !list.includes(String(r[k])))
      } else this.filters.push((r) => r[k] !== v)
      return this
    }
    ilike(k, v) {
      const re = new RegExp('^' + String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i')
      this.filters.push((r) => re.test(String(r[k] ?? '')))
      return this
    }
    or(expr) {
      const parts = expr.split(',').map((p) => p.split('.'))
      this.filters.push((r) => parts.some(([k, op, v]) => op === 'eq' && String(r[k]) === v))
      return this
    }
    order(k, { ascending = true } = {}) { this.orderBy = [k, ascending]; return this }
    limit(n) { this.max = n; return this }
    range() { return this }
    single() { this.mode = 'single'; return this }
    maybeSingle() { this.mode = 'maybe'; return this }
    then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject) }

    matching() {
      let rows = table(this.name).filter((r) => this.filters.every((f) => f(r)))
      if (this.orderBy) {
        const [k, asc] = this.orderBy
        rows = [...rows].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1))
      }
      return rows
    }
    run() {
      calls.push({ table: this.name, op: this.op })
      if (db.failTables.has(this.name)) {
        return { data: null, error: { message: `relation "public.${this.name}" does not exist` }, count: null }
      }
      let rows
      if (this.op === 'insert' || this.op === 'upsert') {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload]
        rows = list.map((p) => {
          const row = { id: uuid(), created_at: new Date().toISOString(), ...(COLUMN_DEFAULTS[this.name] || {}), ...p }
          table(this.name).push(row)
          return row
        })
      } else if (this.op === 'update') {
        rows = this.matching()
        rows.forEach((r) => Object.assign(r, this.payload))
      } else if (this.op === 'delete') {
        rows = this.matching()
        tables[this.name] = table(this.name).filter((r) => !rows.includes(r))
      } else {
        rows = this.matching()
      }
      const count = rows.length
      if (this.max != null) rows = rows.slice(0, this.max)
      rows = rows.map((r) => ({ ...r }))
      if (this.mode === 'single') {
        return rows.length === 1
          ? { data: rows[0], error: null }
          : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
      }
      if (this.mode === 'maybe') return { data: rows[0] ?? null, error: null }
      const wantsRows = this.op === 'select' || this.cols !== undefined
      return { data: wantsRows || this.op === 'select' ? rows : null, error: null, count }
    }
  }

  const db = {
    tables,
    calls,
    failTables: new Set(),
    addUser({ id = uuid(), email, role = 'buyer', name, token }) {
      const t = token || `token-${id}`
      sessions[t] = { id, email: email || `${id}@test.local`, user_metadata: { role } }
      table('users').push({ id, email: sessions[t].email, role, name: name || email || id })
      return { id, token: t }
    },
    client: {
      from: (name) => new Query(name),
      rpc: async () => ({ data: null, error: null }),
      auth: {
        getUser: async (token) => {
          const user = sessions[token]
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid' } }
        },
        admin: {
          getUserById: async (id) => ({ data: { user: Object.values(sessions).find((u) => u.id === id) || null }, error: null }),
          listUsers: async () => ({ data: { users: Object.values(sessions) }, error: null }),
        },
      },
      storage: { from: () => ({ upload: async () => ({ data: {}, error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://x/y' } }) }) },
    },
  }
  return db
}

/** Req/res minimalistes compatibles Vercel Functions. */
export function makeReq({ method = 'GET', url = '/api/health', token, body, headers = {} } = {}) {
  const u = new URL(url, 'http://localhost')
  return {
    method,
    url,
    query: Object.fromEntries(u.searchParams),
    body,
    headers: { 'kcb-api-key': process.env.API_KEY, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  }
}

export function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { res.headers[k] = v },
    removeHeader(k) { delete res.headers[k] },
    getHeader: (k) => res.headers[k],
    status(c) { res.statusCode = c; return res },
    json(b) { res.body = b; return res },
    send(b) { res.body = b; return res },
    end(b) { res.body = b; return res },
  }
  return res
}
