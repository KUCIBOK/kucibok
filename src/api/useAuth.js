import { supabase } from '../lib/supabase'
import { uploadProfileImage } from '../lib/storage'
import { utils } from './useAPI'

const { api } = utils

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise un utilisateur Supabase vers la forme KCB attendue par les composants.
 * Expose `_id` (alias de `id`) pour la compatibilité avec le code existant.
 *
 * @param {import('@supabase/supabase-js').User | null} supabaseUser
 * @returns {object | null}
 */
// NOTE: duplicated from AuthContext — extract to shared util in Phase 2
const toKcbUser = (supabaseUser) => {
  if (!supabaseUser) return null
  return {
    _id: supabaseUser.id,
    id: supabaseUser.id,
    email: supabaseUser.email,
    role: supabaseUser.user_metadata?.role ?? 'buyer',
    name: supabaseUser.user_metadata?.name ?? '',
    isEmailVerified: !!supabaseUser.email_confirmed_at,
    ...supabaseUser.user_metadata,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — SUPABASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connecte un utilisateur avec email + mot de passe.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object } | { error: string }>}
 */
export async function loginUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { user: toKcbUser(data.user) }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Inscrit un nouvel utilisateur. Stocke le rôle et le nom dans user_metadata.
 * Si l'utilisateur est artiste et fournit une photo (File), elle est uploadée
 * dans Supabase Storage (`profiles`) avant la création du compte.
 *
 * @param {{ email: string, password: string, role: string, name: string, image?: File, [key: string]: any }} charge
 * @returns {Promise<{ user: object, message: string } | { error: string }>}
 */
export async function SignUpUser(charge) {
  try {
    const { email, password, role, name, country, institution, image } = charge

    // Appel backend — admin.createUser + envoi magic link via Resend (pas de SMTP Supabase)
    const res = await fetch(`${utils.api}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'kcb-api-key': import.meta.env.VITE_API_KEY,
      },
      body: JSON.stringify({ email, password, role, name, country, institution }),
    })

    const body = await res.json()
    if (!res.ok) return { error: body?.error ?? 'Erreur inscription' }

    const userId = body?.data?.user?.id ?? body?.user?.id
    if (!userId) return { error: 'Erreur inconnue' }

    // ─────────────────────────────────────────────────────────────
    // NEW: Create trial subscription (14 days auto-expiring)
    // ─────────────────────────────────────────────────────────────
    try {
      const trialRes = await fetch(`${utils.api}/subscriptions/create-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      })
      await trialRes.json()
      if (!trialRes.ok) {
        // Non-blocking: Continue even if trial creation fails
      }
    } catch (_trialErr) {
      // Non-blocking: Continue signup even if trial API fails
    }

    // Upload de la photo de profil avec le vrai userId
    let imageUrl = null
    if (role === 'artist' && image instanceof File) {
      const uploadResult = await uploadProfileImage(userId, image)
      if (!uploadResult.error) imageUrl = uploadResult.url
    }

    return {
      user: { _id: userId, id: userId, email, role, name },
      imageUrl,
      message: 'Inscription réussie. Vérifiez votre adresse email pour continuer.',
    }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Déclenche le flux OAuth Google.
 * Supabase redirige vers /auth/callback après authentification.
 *
 * @returns {Promise<{ error: string } | void>}
 */
export async function loginWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) return { error: error.message }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Vérifie l'email après inscription.
 * Supabase gère automatiquement le token via detectSessionInUrl: true —
 * cette fonction récupère la session établie après la redirection du lien email.
 *
 * @returns {Promise<{ user: object } | { error: string }>}
 */
export async function verifyEmail() {
  try {
    // Laisser Supabase un court délai pour traiter le token de l'URL
    await new Promise((resolve) => setTimeout(resolve, 500))
    const { data, error } = await supabase.auth.getSession()
    if (error) return { error: error.message }
    if (!data.session?.user) return { error: 'Lien de vérification invalide ou expiré.' }
    return { user: toKcbUser(data.session.user) }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Envoie un email de réinitialisation du mot de passe.
 *
 * @param {{ email: string }} payload
 * @returns {Promise<{ ok: true } | { error: string }>}
 */
export async function forgotPassword({ email }) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) return { error: error.message }
    return { ok: true }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Réinitialise le mot de passe après clic sur le lien email.
 * À appeler depuis la page /auth/reset-password (session active requise).
 *
 * @param {{ password: string }} payload
 * @returns {Promise<{ ok: true, user: object } | { error: string }>}
 */
export async function resetPassword({ password }) {
  try {
    // Route via backend (service_role) — le token de récupération est déjà dans utils.options
    // (setSupabaseToken est appelé lors du PASSWORD_RECOVERY event)
    const response = await fetch(`${api}/auth/reset-password`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    const body = await response.json()
    if (!response.ok) return { error: body?.error || 'Erreur réinitialisation' }
    return { ok: true }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Déconnecte l'utilisateur et invalide la session Supabase.
 *
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  await supabase.auth.signOut()
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL & UTILISATEUR — BACKEND (migration M2 → Supabase PostgreSQL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Récupère le profil étendu d'un utilisateur (artiste ou buyer/curator) depuis Supabase.
 *
 * @param {string} id - UUID Supabase de l'utilisateur
 * @returns {Promise<object | { error: string }>}
 */
export async function getUserProfile(id) {
  try {
    const response = await fetch(`${api}/profile/${id}`, { ...utils.options })
    const body = await response.json()
    // Les Vercel Functions retournent { data: {...} }
    const data = body?.data ?? body
    if (data?.id || data?._id || data?.userId) return data
    return { error: body?.error ?? 'Profil introuvable' }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Récupère les données publiques d'un utilisateur par son UUID Supabase.
 *
 * @param {string} id
 * @returns {Promise<object | { error: string }>}
 */
export async function getUserById(id) {
  try {
    const response = await fetch(`${api}/auth/${id}`, { ...utils.options })
    const body = await response.json()
    const data = body?.data ?? body
    if (data?.id || data?._id) return data
    return { error: body?.error ?? 'Utilisateur introuvable' }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Met à jour les données utilisateur dans Supabase (public.users + user_metadata).
 *
 * @param {string} id
 * @param {object} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function updateUser(id, payload) {
  try {
    const response = await fetch(`${api}/auth/${id}`, {
      ...utils.options,
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    const user = body?.data ?? body
    if (user?.role || user?._id) return user
    return { error: body?.error ?? body?.message }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Met à jour le profil utilisateur dans Supabase (artists ou profiles).
 * Si le payload contient un fichier image (FormData avec clé `image`),
 * l'image est d'abord uploadée vers Supabase Storage et remplacée par son URL publique.
 * Le backend reçoit du JSON (plus de multipart).
 *
 * @param {string} id - UUID Supabase de l'utilisateur
 * @param {FormData} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function updateProfile(id, payload) {
  try {
    const fields = {}
    let imageFile = null

    // ✅ FIX: Handle both FormData and plain objects, convert types back
    if (payload instanceof FormData) {
      for (const [key, value] of payload.entries()) {
        if (value instanceof File) {
          imageFile = value
        } else {
          if (value === 'true') fields[key] = true
          else if (value === 'false') fields[key] = false
          else if (!isNaN(value) && value !== '') fields[key] = parseFloat(value)
          else fields[key] = value
        }
      }
    } else {
      Object.assign(fields, payload)
    }

    // ✅ FIX: Upload image BEFORE sending JSON (if present)
    if (imageFile) {
      const uploadResult = await uploadProfileImage(id, imageFile)
      if (uploadResult.error) return { error: uploadResult.error }
      fields.image = uploadResult.url
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''

    const response = await fetch(`${api}/profile/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'kcb-api-key': import.meta.env.VITE_API_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(fields),
    })
    const body = await response.json()
    const profile = body?.data ?? body
    if (profile?.userId) return profile
    return { error: body?.error || body?.message }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Définit le rôle initial après inscription Google OAuth.
 * Endpoint dédié — autorisé uniquement si le rôle actuel est 'buyer'.
 *
 * @param {'artist' | 'curator'} role
 * @returns {Promise<object | { error: string }>}
 */
export async function setInitialRole(role) {
  try {
    const response = await fetch(`${api}/auth/set-role`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify({ role }),
    })
    const body = await response.json()
    const user = body?.data ?? body
    if (user?._id) return user
    return { error: body?.error ?? body?.message ?? 'Erreur attribution du rôle' }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Change le mot de passe de l'utilisateur connecté.
 * Vérifie l'ancien mot de passe côté serveur avant la mise à jour.
 *
 * @param {{ oldPassword: string, newPassword: string }} payload
 * @returns {Promise<object | { error: string }>}
 */
export async function changePassword(payload) {
  try {
    const response = await fetch(`${api}/auth/change-password`, {
      ...utils.options,
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    const user = body?.data ?? body
    if (user?._id) return user
    return { error: body?.error || body?.message }
  } catch (err) {
    return { error: err.message }
  }
}
