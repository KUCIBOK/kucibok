/**
 * P4-META-002 — Helper API unifié
 *
 * Problème résolu :
 *   - Les fichiers api/* font `const { options } = utils` au niveau du module
 *     → le getter est évalué UNE FOIS à l'init → token figé à null si login tardif
 *   - Chaque fonction retourne un format différent (array, objet, { error })
 *
 * Solution :
 *   - buildOptions() : construit les options fetch en lisant le token à chaque appel
 *   - callApi()      : wrapper fetch → retourne toujours { data, error, status }
 *
 * Usage dans un nouveau fichier API :
 *   import { buildOptions, callApi } from "./apiHelper";
 *   const { data, error } = await callApi(`${API_URL}/artworks`, buildOptions());
 */

const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

/**
 * Construit les options fetch avec lecture dynamique du token.
 * À appeler DANS chaque fonction API, pas au niveau du module.
 *
 * @param {string}  [method="GET"]  - Méthode HTTP
 * @param {Object}  [body=null]     - Corps de la requête (sera JSON.stringify)
 * @param {Object}  [extraHeaders]  - Headers supplémentaires
 * @returns {RequestInit}
 */
export function buildOptions(method = "GET", body = null, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    "kcb-api-key": API_KEY,
    Accept: "*/*",
    // Token lu dynamiquement : correct même si login après chargement
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    ...extraHeaders,
  };

  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);
  return opts;
}

/**
 * Wrapper fetch uniforme.
 * Toujours retourner { data, error, status } — jamais throw.
 *
 * @param {string}      url         - URL complète
 * @param {RequestInit} [fetchOpts] - Options fetch (utiliser buildOptions())
 * @returns {Promise<{ data: any, error: string|null, status: number }>}
 */
export async function callApi(url, fetchOpts = buildOptions()) {
  try {
    const response = await fetch(url, fetchOpts);
    const data = await response.json();

    if (response.ok) {
      return { data, error: null, status: response.status };
    }

    // Le backend retourne { error, message, code } selon errorHandler.js
    const errorMsg = data?.error || data?.message || `Erreur HTTP ${response.status}`;
    return { data: null, error: errorMsg, status: response.status };
  } catch (err) {
    return { data: null, error: err.message, status: 0 };
  }
}

/**
 * Raccourci : URL complète depuis le chemin relatif.
 * @param {string} path - Ex: "/artworks/approved"
 * @returns {string}
 */
export function apiUrl(path) {
  return `${API_URL}${path}`;
}
