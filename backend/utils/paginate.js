/**
 * P3-PERF-001 — Helper de pagination
 *
 * Usage dans un contrôleur :
 *   const result = await paginate(Artwork, { status: 'approved' }, req);
 *   return res.status(200).json(result);
 *
 * Réponse :
 *   { data: [...], total: N, page: P, limit: L, totalPages: T }
 *
 * Paramètres query supportés :
 *   ?page=1&limit=20
 */

/**
 * @param {import('mongoose').Model} Model - Modèle Mongoose cible
 * @param {Object}  filter  - Filtre MongoDB (ex: { status: 'approved' })
 * @param {Object}  req     - Requête Express (lit req.query.page et req.query.limit)
 * @param {Object}  [opts]  - Options supplémentaires
 * @param {Object}  [opts.select]    - Projection (ex: '-password')
 * @param {Object}  [opts.populate]  - Populate Mongoose
 * @param {Object}  [opts.sort]      - Tri (ex: { createdAt: -1 })
 * @returns {Promise<{ data: Array, total: number, page: number, limit: number, totalPages: number }>}
 */
async function paginate(Model, filter, req, opts = {}) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  let query = Model.find(filter).skip(skip).limit(limit).lean();

  if (opts.select)   query = query.select(opts.select);
  if (opts.populate) query = query.populate(opts.populate);
  if (opts.sort)     query = query.sort(opts.sort);

  const [data, total] = await Promise.all([
    query,
    Model.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { paginate };
