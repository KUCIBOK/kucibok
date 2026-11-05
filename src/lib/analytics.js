/**
 * Événements Google Analytics 4 (gtag est chargé dans index.html).
 *
 * `window.gtag?.()` : aucune erreur si GA est absent (bloqueur de publicité, cookies refusés).
 * À appeler UNIQUEMENT quand l'action a réussi côté serveur, jamais au simple clic.
 */

const send = (name, params) => {
  try {
    if (typeof window !== 'undefined') window.gtag?.('event', name, params)
  } catch {
    // le suivi ne doit jamais casser le parcours utilisateur
  }
}

const path = () => (typeof window !== 'undefined' ? window.location.pathname : '')

/** @param {'contact'|'demo'|'sourcing_quote'} formType */
export const trackLead = (formType) => send('generate_lead', { form_type: formType, page_path: path() })

/** @param {'email'|'google'} method */
export const trackSignUp = (method) => send('sign_up', { method })
