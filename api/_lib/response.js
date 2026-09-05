import { supabaseAdmin as defaultSupabaseAdmin } from './supabase.js';

/**
 * response.js — Helpers de réponse HTTP standardisés pour les Vercel Functions.
 *
 * Format uniforme : { data?, error?, pagination? }
 * Toutes les réponses incluent les headers CORS.
 *
 * @module api/_lib/response
 */

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://kucibok.com';

/** Headers CORS communs à toutes les réponses. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, kcb-api-key',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Applique les headers CORS sur la réponse.
 *
 * @param {import('@vercel/node').VercelResponse} res
 */
export function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

/**
 * Gère les requêtes OPTIONS (preflight CORS).
 *
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 * @returns {boolean} true si la requête était un preflight (handler doit return)
 */
export function handleCors(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Réponse de succès.
 *
 * @param {import('@vercel/node').VercelResponse} res
 * @param {object | object[]} data
 * @param {number} [status=200]
 * @param {{ page?: number, limit?: number, total?: number }} [pagination]
 */
export function ok(res, data, status = 200, pagination) {
  setCors(res);
  const body = { data };
  if (pagination) body.pagination = pagination;
  return res.status(status).json(body);
}

/**
 * Réponse d'erreur standardisée.
 *
 * Format: { error: string, status: number, timestamp: ISO8601 }
 *
 * @param {import('@vercel/node').VercelResponse} res
 * @param {string} message
 * @param {number} [status=400]
 */
export function fail(res, message, status = 400) {
  setCors(res);
  return res.status(status).json({
    error: message,
    status,
    timestamp: new Date().toISOString()
  });
}

/**
 * Réponse d'erreur avec détails additionnels (validation errors, etc)
 *
 * @param {import('@vercel/node').VercelResponse} res
 * @param {string} message
 * @param {object} [details] - Additionaldetails (e.g., validation errors)
 * @param {number} [status=400]
 */
export function failWithDetails(res, message, details = {}, status = 400) {
  setCors(res);
  return res.status(status).json({
    error: message,
    details,
    status,
    timestamp: new Date().toISOString()
  });
}

/**
 * Réponse 404.
 *
 * @param {import('@vercel/node').VercelResponse} res
 * @param {string} [entity='Ressource']
 */
export const notFound = (res, entity = 'Ressource') =>
  fail(res, `${entity} introuvable`, 404);

/**
 * Réponse 500 — erreur serveur inattendue.
 *
 * @param {import('@vercel/node').VercelResponse} res
 * @param {Error} err
 */
export const serverError = (res, err) => {
  console.error('[API ERROR]', err?.message ?? err);
  return fail(res, 'Erreur serveur interne', 500);
};

/**
 * Parse la pagination depuis les query params.
 *
 * @param {import('@vercel/node').VercelRequest} req
 * @returns {{ page: number, limit: number, from: number, to: number }}
 */
export function parsePagination(req) {
  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;
  return { page, limit, from, to };
}

/**
 * Réponse JSON curried — retourne une fonction qui prend res
 * @param {number} status
 * @param {object} body
 * @returns {function}
 */
export function respondJSON(status, body) {
  return (res) => {
    setCors(res);
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).json(body);
  };
}

/**
 * Réponse d'erreur curried — retourne une fonction qui prend res
 * @param {number} status
 * @param {string} message
 * @returns {function}
 */
export function respondError(status, message) {
  return (res) => {
    setCors(res);
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).json({ error: message });
  };
}

/**
 * Vérifie l'authentification JWT depuis Authorization header
 * Retourne { userId, user_id, user } si OK
 * Retourne { error, status } si erreur
 * ✅ Utilise Supabase pour vérifier la signature du JWT
 * @param {import('@vercel/node').VercelRequest} req
 * @param {object} supabaseAdmin - Client Supabase admin
 * @returns {Promise<object>}
 */
export async function checkAuth(req, supabaseAdmin = defaultSupabaseAdmin) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return { error: 'Missing Authorization header', status: 401 };
  }

  try {
    // ✅ VRAI vérification JWT avec Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { error: 'Invalid or expired token', status: 401 };
    }

    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    return {
      userId: user.id,
      user_id: user.id,
      role: dbUser?.role ?? 'buyer',
      user: { ...user, role: dbUser?.role ?? 'buyer' },
    };
  } catch (error) {
    console.error('[Auth Error]', error.message);
    return { error: 'Invalid token', status: 401 };
  }
}
