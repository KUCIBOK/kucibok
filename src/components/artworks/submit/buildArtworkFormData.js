/**
 * Construit le FormData envoyé à submitArtwork à partir de l'état du formulaire de soumission.
 *
 * - L'identité (user, artiste) n'est jamais envoyée : le serveur la déduit du jeton.
 * - Les valeurs vides ne sont pas envoyées (une chaîne vide viole la contrainte `condition`
 *   et n'est pas un UUID valide pour `categoryId`).
 * - Les mots-clés partent en JSON.
 *
 * @param {object} formState état du formulaire (SubmitArtwork)
 * @returns {FormData}
 */
const UI_ONLY_FIELDS = ['step', 'tag', 'loading', 'show', 'error', 'artist', 'artistId', 'userId']

export function buildArtworkFormData(formState) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(formState)) {
    if (UI_ONLY_FIELDS.includes(key)) continue
    if (value === null || value === undefined || value === '') continue
    if (key === 'tags') {
      if (Array.isArray(value) && value.length) formData.append(key, JSON.stringify(value))
      continue
    }
    formData.append(key, value)
  }
  return formData
}
