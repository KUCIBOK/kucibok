/**
 * api/artworks.js
 *
 * Point d'entrée /api/artworks : délègue entièrement au catch-all [...path].js,
 * qui porte la logique de visibilité (approuvé par défaut, statuts et listes
 * propriétaire réservés au propriétaire ou à l'admin) et la création d'œuvres.
 * Une seule implémentation évite que les deux copies divergent.
 */

export { default } from './[...path].js'
