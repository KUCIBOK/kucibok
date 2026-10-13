import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ROLE_DASHBOARDS = {
  artist: '/dashboard/artist',
  curator: '/dashboard/curator',
  advisor: '/dashboard/advisor',
  buyer: '/account',
  admin: '/dashboard/admin',
}

/**
 * Page de callback OAuth Google — `/auth/callback`.
 *
 * Supabase redirige ici après un `signInWithOAuth({ provider: 'google' })`.
 * Cette page :
 *   1. Attend que Supabase échange le code et établisse la session.
 *   2. Appelle `POST /api/auth/google-callback` pour créer/vérifier la ligne `public.users`.
 *   3. Redirige vers `/auth/role-selection` si premier accès Google (pas de rôle encore),
 *      sinon vers le dashboard correspondant au rôle de l'utilisateur.
 *
 * @returns {JSX.Element}
 */
export default function OAuthCallback() {
  const navigate = useNavigate()
  const processed = useRef(false)
  const [status, setStatus] = useState('loading') // 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    /**
     * Traite la session Supabase post-OAuth :
     * appelle le backend pour créer/vérifier l'utilisateur, puis redirige.
     *
     * @param {import('@supabase/supabase-js').Session} session
     * @returns {Promise<void>}
     */
    const handleSession = async (session) => {
      if (processed.current) return
      processed.current = true

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/google-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'kcb-api-key': import.meta.env.VITE_API_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ access_token: session.access_token }),
        })

        const body = await response.json()
        const data = body?.data ?? body

        if (!response.ok) {
          throw new Error(data?.error ?? 'Erreur lors de la connexion Google')
        }

        if (data.needs_role_selection) {
          navigate('/auth/role-selection', { replace: true })
        } else {
          // Pas de rôle par défaut : un rôle absent renvoie à l'accueil plutôt qu'au compte acheteur
          const dashboard = ROLE_DASHBOARDS[data.user?.role] ?? '/'
          navigate(dashboard, { replace: true })
        }
      } catch (err) {
        setErrorMsg(err.message || 'Une erreur est survenue')
        setStatus('error')
      }
    }

    // Écoute le changement d'état auth (Supabase échange le code automatiquement)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        handleSession(session)
      }
    })

    // Fallback : session déjà disponible avant que l'abonnement soit posé
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  if (status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f0f0f',
          color: '#f5f5f5',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <p style={{ fontSize: '18px', color: '#f87171' }}>Connexion impossible</p>
        <p style={{ fontSize: '14px', color: '#9ca3af', maxWidth: '360px' }}>{errorMsg}</p>
        <button
          onClick={() => navigate('/sign-in', { replace: true })}
          style={{
            marginTop: '8px',
            padding: '10px 24px',
            background: '#C9A84C',
            border: 'none',
            borderRadius: '6px',
            color: '#0A0A0A',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          Retour à la connexion
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f0f0f',
        color: '#f5f5f5',
        gap: '16px',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        style={{ animation: 'spin 1s linear infinite' }}
      >
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="#C9A84C"
          strokeWidth="3"
          strokeDasharray="80"
          strokeDashoffset="20"
          strokeLinecap="round"
        />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </svg>
      <p style={{ fontSize: '15px', color: '#9ca3af' }}>Connexion en cours…</p>
    </div>
  )
}
