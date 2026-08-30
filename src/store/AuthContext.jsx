import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { setSupabaseToken, utils } from '../api/useAPI'
import { changePassword, getUserProfile, updateProfile, updateUser } from '../api/useAuth'
import { updateArtist } from '../api/useArtists'
import { createLog } from '../api/useLog'
import { getMySubscription } from '../api/useSubscriptions'

/** @type {React.Context} */
export const AuthContext = createContext(null)

/**
 * Normalise un utilisateur Supabase vers la forme KCB.
 *
 * @param {import('@supabase/supabase-js').User | null} supabaseUser
 * @returns {object | null}
 */
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

/**
 * Retourne la clé de profil dans le state selon le rôle.
 *
 * @param {string} role
 * @returns {string}
 */
const profileKeyForRole = (role) => {
  const map = {
    artist: 'artistProfile',
    buyer: 'buyerProfile',
    curator: 'curatorProfile',
    advisor: 'advisorProfile',
    admin: 'adminProfile',
  }
  return map[role] ?? 'buyerProfile'
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fournit le contexte d'authentification à toute l'application.
 * Utilise supabase.auth.onAuthStateChange() comme source de vérité unique.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthContextProvider({ children }) {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [artistProfile, setArtistProfile] = useState(null)
  const [buyerProfile, setBuyerProfile] = useState(null)
  const [curatorProfile, setCuratorProfile] = useState(null)
  const [advisorProfile, setAdvisorProfile] = useState(null)
  const [adminProfile, setAdminProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Chargement de l'abonnement actif ─────────────────────────────────────────
  const loadSubscription = useCallback(async () => {
    try {
      const sub = await getMySubscription()
      setSubscription(sub ?? null)
      setPlan(sub?.plan ?? null)
    } catch {
      // Abonnement non critique — ne pas bloquer l'auth
    }
  }, [])

  // ── Chargement du profil étendu (Supabase — artists / profiles) ─────────────
  const loadProfile = useCallback(async (kcbUser) => {
    if (!kcbUser?._id) return
    try {
      const profileData = await getUserProfile(kcbUser._id)
      // ✅ FIX: Check for `id` field (Supabase), not just `_id` or `userId`
      if (!profileData?.id && !profileData?._id && !profileData?.userId) return
      const key = profileKeyForRole(kcbUser.role)
      if (key === 'artistProfile') setArtistProfile(profileData)
      else if (key === 'buyerProfile') setBuyerProfile(profileData)
      else if (key === 'curatorProfile') setCuratorProfile(profileData)
      else if (key === 'advisorProfile') setAdvisorProfile(profileData)
      else if (key === 'adminProfile') setAdminProfile(profileData)
    } catch {
      // Profil étendu non critique — ne pas bloquer l'authentification
    }
  }, [])

  /**
   * Récupère le rôle autoritatif depuis /api/auth/me (service_role, bypass RLS).
   * Fallback : query directe supabase si l'API échoue (token pas encore prêt, réseau, etc.)
   */
  const loadDbRole = useCallback(async (userId, fallbackRole) => {
    if (!userId) return fallbackRole ?? null
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('loadDbRole timeout')), 5000)
      )
      const query = fetch(`${utils.api}/auth/me`, { ...utils.options })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => body?.data?.role ?? null)
      const role = await Promise.race([query, timeout])
      if (role) return role
    } catch {
      // fallback ci-dessous
    }
    // Fallback : query directe (peut échouer si RLS non configurée, mais tente quand même)
    try {
      const { data } = await supabase.from('users').select('role').eq('id', userId).single()
      if (data?.role) return data.role
    } catch {
      // ignore
    }
    return fallbackRole ?? null
  }, [])

  // ── Failsafe : si loading est encore true après 5s, forcer false ──────────
  // Protège contre les cas où Supabase est totalement inaccessible.
  useEffect(() => {
    if (!loading) return
    const id = setTimeout(() => setLoading(false), 5000)
    return () => clearTimeout(id)
  }, [loading])

  // ── Écoute les changements de session Supabase ────────────────────────────
  const loadedRef = useRef(false)

  useEffect(() => {
    // Récupère la session initiale au montage — guard against double invocation (React StrictMode)
    if (!loadedRef.current) {
      loadedRef.current = true
      supabase.auth
        .getSession()
        .then(async ({ data: { session } }) => {
          setSupabaseToken(session?.access_token ?? null)
          const kcbUser = toKcbUser(session?.user ?? null)
          try {
            if (kcbUser) {
              const dbRole = await loadDbRole(kcbUser._id, kcbUser.role)
              kcbUser.role = dbRole ?? 'buyer'
              setUser(kcbUser)
              // ✅ CRITICAL: Wait for profile to load before marking loading as false
              await loadProfile(kcbUser)
              await loadSubscription()
            } else {
              setUser(null)
            }
          } catch {
            // Préserve le rôle user_metadata (posé par le serveur) plutôt que de rétrograder à buyer
            if (kcbUser) {
              kcbUser.role = kcbUser.role ?? 'buyer'
              setUser(kcbUser)
            } else setUser(null)
          } finally {
            setLoading(false)
          }
        })
        .catch(() => setLoading(false))
    }

    // S'abonne aux changements (login, logout, refresh token, OAuth callback)
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Synchronise le token dans useAPI.js à chaque changement de session
      setSupabaseToken(session?.access_token ?? null)

      const kcbUser = toKcbUser(session?.user ?? null)

      try {
        if (kcbUser) {
          const dbRole = await loadDbRole(kcbUser._id, kcbUser.role)
          kcbUser.role = dbRole ?? 'buyer'
          setUser(kcbUser)
        } else {
          setUser(null)
        }

        if (event === 'SIGNED_IN' && kcbUser) {
          await loadProfile(kcbUser)
          await loadSubscription()
          createLog({
            description: `L'utilisateur ${kcbUser.name || kcbUser.email} s'est connecté`,
            userId: kcbUser._id,
          }).catch(() => {})
        }

        if (event === 'SIGNED_OUT') {
          setArtistProfile(null)
          setBuyerProfile(null)
          setCuratorProfile(null)
          setAdvisorProfile(null)
          setAdminProfile(null)
          setSubscription(null)
          setPlan(null)
        }
      } catch {
        if (kcbUser) {
          kcbUser.role = kcbUser.role ?? 'buyer'
          setUser(kcbUser)
        } else setUser(null)
      } finally {
        setLoading(false)
      }
    })

    return () => authListener.unsubscribe()
  }, [loadProfile, loadDbRole, loadSubscription])

  // ── Actions exposées ──────────────────────────────────────────────────────

  /** Déconnecte l'utilisateur et redirige vers l'accueil. */
  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    navigate('/')
  }, [navigate])

  /** Met à jour le profil selon le rôle de l'utilisateur. */
  const setProfile = useCallback(
    (profile) => {
      if (!user?.role) return
      const key = profileKeyForRole(user.role)
      if (key === 'artistProfile') setArtistProfile(profile)
      else if (key === 'buyerProfile') setBuyerProfile(profile)
      else if (key === 'curatorProfile') setCuratorProfile(profile)
      else if (key === 'adminProfile') setAdminProfile(profile)
    },
    [user]
  )

  /** Met à jour les données utilisateur dans Supabase (public.users + user_metadata). */
  const updateUserCtx = useCallback(
    async (payload) => {
      if (!user?._id) return { error: 'Utilisateur non connecté.' }
      // Ne jamais autoriser le changement de rôle depuis le frontend
      const { role: _discardedRole, ...safePayload } = payload
      const updated = await updateUser(user._id, safePayload)
      if (updated?._id) {
        // Sync le user_metadata Supabase si le nom change (jamais le rôle)
        if (safePayload.name) {
          await supabase.auth.updateUser({ data: { name: safePayload.name } })
        }
        setUser((prev) => ({ ...prev, ...updated }))
        await createLog({
          description: `L'utilisateur ${updated.name} s'est mis à jour`,
          userId: updated._id,
        }).catch(() => {})
        return updated
      }
      return { error: updated?.error || updated?.message }
    },
    [user]
  )

  /** Met à jour le profil artiste. */
  const updateArtistCtx = useCallback(
    async (idOrPayload, payload) => {
      if (!user?.id || !artistProfile?.id) return { error: 'Utilisateur non connecté.' }

      // ✅ FIX: Handle both calling conventions
      // Called as updateArtist(artistProfile.id, formData) from Profile.jsx
      // Or as updateArtist(formData) from other places
      let artistId = artistProfile.id
      let dataPayload = payload

      if (payload === undefined) {
        // Called with single argument: updateArtist(formData)
        dataPayload = idOrPayload
      } else {
        // Called with two arguments: updateArtist(id, formData)
        artistId = idOrPayload
      }

      const profile = await updateArtist(artistId, dataPayload)
      if (profile?.id) {
        setArtistProfile(profile)
        await createLog({
          description: `L'utilisateur ${user.name} a mis son profil Artiste à jour`,
          userId: user.id,
        }).catch(() => {})
        return profile
      }
      return { error: profile?.error || profile?.message }
    },
    [user, artistProfile]
  )

  /** Met à jour le profil buyer / curator. */
  const updateProfileCtx = useCallback(
    async (payload) => {
      if (!user?._id) return { error: 'Utilisateur non connecté.' }
      const profile = await updateProfile(user._id, payload)
      if (profile?._id) {
        setProfile(profile)
        await createLog({
          description: `L'utilisateur ${user.name} a mis son profil à jour`,
          userId: user._id,
        }).catch(() => {})
        return profile
      }
      return { error: profile?.error || profile?.message }
    },
    [user, setProfile]
  )

  /** Change le mot de passe via Supabase Auth (vérifie l'ancien mot de passe côté serveur). */
  const changePasswordCtx = useCallback(
    async (payload) => {
      const result = await changePassword(payload)
      if (result?._id) {
        await createLog({
          description: `L'utilisateur ${user?.name} a changé son mot de passe`,
          userId: user?._id,
        }).catch(() => {})
        return result
      }
      return { error: result?.error || result?.message }
    },
    [user]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Trial computed values
  // ─────────────────────────────────────────────────────────────────────────
  const trialDaysLeft = subscription?.trial_end_date
    ? Math.ceil(
        (new Date(subscription.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24)
      )
    : null

  const isTrialExpired =
    subscription?.is_trial && trialDaysLeft !== null && trialDaysLeft <= 0

  const isTrialActive = subscription?.is_trial && !isTrialExpired

  const isTrialExpiringSoon = isTrialActive && trialDaysLeft !== null && trialDaysLeft <= 7

  // ─────────────────────────────────────────────────────────────────────────
  const value = useMemo(
    () => ({
      user,
      artistProfile,
      buyerProfile,
      curatorProfile,
      advisorProfile,
      adminProfile,
      subscription,
      plan,
      loading,
      logout,
      setProfile,
      loadSubscription,
      updateUser: updateUserCtx,
      updateArtist: updateArtistCtx,
      updateProfile: updateProfileCtx,
      changePassword: changePasswordCtx,
      // Trial helper values
      trialDaysLeft,
      isTrialExpired,
      isTrialActive,
      isTrialExpiringSoon,
    }),
    [
      user,
      artistProfile,
      buyerProfile,
      curatorProfile,
      advisorProfile,
      adminProfile,
      subscription,
      plan,
      loading,
      logout,
      setProfile,
      loadSubscription,
      updateUserCtx,
      updateArtistCtx,
      updateProfileCtx,
      changePasswordCtx,
      trialDaysLeft,
      isTrialExpired,
      isTrialActive,
      isTrialExpiringSoon,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook d'accès au contexte d'authentification.
 *
 * @returns {ReturnType<typeof AuthContextProvider> extends { value: infer V } ? V : never}
 */
export function useAuth() {
  return useContext(AuthContext)
}
