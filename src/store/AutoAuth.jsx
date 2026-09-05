/**
 * AutoAuth — Composant de redirection post-OAuth.
 *
 * Avec Supabase, la session est gérée automatiquement par onAuthStateChange()
 * dans AuthContext. Ce composant gère uniquement les redirections post-OAuth
 * (callback Google) — il ne fait PAS de getSession() pour éviter le double appel.
 *
 * Il ne fait rien de visible — retourne un fragment vide.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** @type {Record<string, string>} Mapping rôle → route dashboard */
const DASHBOARD_BY_ROLE = {
  artist: '/dashboard/artist',
  curator: '/dashboard/curator',
  advisor: '/dashboard/advisor',
  buyer: '/account',
  admin: '/dashboard/admin',
}

/**
 * Gère les redirections OAuth. La session est déjà restaurée par AuthContext.
 * À monter une seule fois, au plus haut niveau de l'arbre de composants.
 *
 * @returns {React.ReactElement}
 */
export function AutoAuth() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    // OAuthCallback doit traiter la session et role-selection doit rester affiché.
    if (window.location.pathname === '/auth/callback' || window.location.pathname === '/auth/role-selection') {
      return
    }

    // Redirige vers le dashboard uniquement après un callback OAuth
    const isOAuthCallback = window.location.hash.includes('access_token')
    if (isOAuthCallback && user?.role && DASHBOARD_BY_ROLE[user.role]) {
      navigate(DASHBOARD_BY_ROLE[user.role])
    }
  }, [navigate, user])

  return <></>
}
