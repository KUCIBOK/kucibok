/**
 * api/_modules/artwork-input.js — Validation et conversion des données d'une œuvre reçues du client.
 *
 * Le serveur n'insère JAMAIS le corps de la requête tel quel :
 *  - seules les colonnes de la liste blanche sont conservées (pas de `sold`, `featured`, `status`,
 *    `kucibok_id`, `owner_id`… : ils relèvent du serveur ou de la modération) ;
 *  - les noms camelCase du formulaire (`forSale`, `auctionStatus`, `categoryId`…) sont convertis ;
 *  - les types sont convertis (nombres, booléens, mots-clés en tableau) et les chaînes vides deviennent NULL ;
 *  - les erreurs sont renvoyées sous forme de phrases lisibles par l'utilisateur.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const CONDITIONS = ['excellent', 'very_good', 'good', 'fair']
export const CURRENCIES = ['USD', 'EUR', 'FCFA', 'XOF']

const ALIASES = {
  forSale: 'for_sale',
  forBid: 'for_bid',
  auctionStatus: 'auction_status',
  availabilityStatus: 'availability_status',
  categoryId: 'category_id',
  editionNumber: 'edition_number',
  editionTotal: 'edition_total',
  deliveryDetails: 'delivery_details',
}

const TEXT_LIMITS = { title: 200, description: 10000, medium: 200, provenance: 2000, category: 100, delivery_details: 2000 }
const DECIMALS = ['height', 'width', 'weight', 'price']
const INTEGERS = ['edition_number', 'edition_total']
const BOOLEANS = ['for_sale', 'for_bid']
const STATUS_FIELDS = ['auction_status', 'availability_status']
const MAX_TAGS = 10
const MAX_TAG_LENGTH = 30

const isBlank = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

const toTags = (value) => {
  if (Array.isArray(value)) return value
  const text = String(value).trim()
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed
    } catch { /* texte libre : traité ci-dessous */ }
  }
  return text.split(',')
}

/**
 * @param {object} input corps de la requête (JSON)
 * @param {{ partial?: boolean }} [options] partial: mise à jour, seuls les champs présents sont traités
 * @returns {{ data: object, errors: string[] }}
 */
export function normalizeArtworkInput(input, { partial = false } = {}) {
  const raw = {}
  for (const [key, value] of Object.entries(input && typeof input === 'object' ? input : {})) {
    const target = ALIASES[key] ?? key
    // La forme snake_case l'emporte si les deux sont présentes
    if (key in ALIASES && target in input) continue
    raw[target] = value
  }

  const data = {}
  const errors = []
  const has = (key) => Object.prototype.hasOwnProperty.call(raw, key)

  // Texte
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    if (!has(key)) continue
    const text = isBlank(raw[key]) ? null : String(raw[key]).trim()
    if (text && text.length > max) errors.push(`${key} must be ${max} characters or fewer`)
    else data[key] = text
  }
  if (!partial && !data.title) errors.push('title is required')
  if (partial && has('title') && !data.title) errors.push('title cannot be empty')

  // Contrainte condition
  if (has('condition')) {
    if (isBlank(raw.condition)) data.condition = null
    else if (CONDITIONS.includes(raw.condition)) data.condition = raw.condition
    else errors.push(`condition must be one of: ${CONDITIONS.join(', ')}`)
  }

  // Nombres
  for (const key of DECIMALS) {
    if (!has(key)) continue
    if (isBlank(raw[key])) { data[key] = null; continue }
    const number = typeof raw[key] === 'boolean' ? NaN : Number(raw[key])
    if (!Number.isFinite(number) || number < 0) errors.push(`${key} must be a positive number`)
    else data[key] = number
  }
  for (const key of INTEGERS) {
    if (!has(key)) continue
    if (isBlank(raw[key])) { data[key] = null; continue }
    const number = Number(raw[key])
    if (!Number.isInteger(number) || number < 1) errors.push(`${key} must be a whole number of 1 or more`)
    else data[key] = number
  }

  // Booléens
  for (const key of BOOLEANS) {
    if (!has(key) || isBlank(raw[key])) continue
    const value = raw[key]
    if (value === true || value === 'true' || value === 1 || value === '1') data[key] = true
    else if (value === false || value === 'false' || value === 0 || value === '0') data[key] = false
    else errors.push(`${key} must be a boolean`)
  }

  // Devise
  if (has('currency') && !isBlank(raw.currency)) {
    const currency = String(raw.currency).trim().toUpperCase()
    if (CURRENCIES.includes(currency)) data.currency = currency
    else errors.push(`currency must be one of: ${CURRENCIES.join(', ')}`)
  }

  // Statuts de vente
  for (const key of STATUS_FIELDS) {
    if (!has(key) || isBlank(raw[key])) continue
    const value = String(raw[key]).trim()
    if (/^[a-z_]{1,40}$/.test(value)) data[key] = value
    else errors.push(`${key} is invalid`)
  }

  // Catégorie
  if (has('category_id')) {
    if (isBlank(raw.category_id)) data.category_id = null
    else if (UUID_RE.test(String(raw.category_id).trim())) data.category_id = String(raw.category_id).trim()
    else errors.push('category_id must be a valid category id')
  }

  // Mots-clés
  if (has('tags')) {
    if (isBlank(raw.tags)) data.tags = []
    else {
      const tags = toTags(raw.tags).map((tag) => String(tag).trim()).filter(Boolean)
      if (tags.length > MAX_TAGS) errors.push(`tags: ${MAX_TAGS} keywords maximum`)
      else if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) errors.push(`tags: ${MAX_TAG_LENGTH} characters maximum per keyword`)
      else data.tags = tags
    }
  }

  // Image : URL https uniquement (jamais javascript:, data:, http:)
  if (has('image')) {
    if (isBlank(raw.image)) data.image = null
    else {
      const url = String(raw.image).trim()
      if (/^https:\/\/\S+$/i.test(url) && url.length <= 2000) data.image = url
      else errors.push('image must be an https URL')
    }
  }

  return { data, errors }
}

/** Traduit une erreur de base de données en message utilisateur (sans détail interne). */
export function artworkDatabaseError(error) {
  switch (error?.code) {
    case '23503': return { status: 400, message: 'Référence inconnue : vérifiez la catégorie choisie.' }
    case '23514': return { status: 400, message: 'Une valeur est refusée par la base (état, prix…). Vérifiez le formulaire.' }
    case '22P02': return { status: 400, message: 'Une valeur a un format invalide. Vérifiez le formulaire.' }
    case '23505': return { status: 409, message: 'This artwork already exists' }
    default: return { status: 500, message: 'Failed to save artwork' }
  }
}
