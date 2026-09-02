import { BrowserRouter } from 'react-router-dom'
import { Router } from './routes/Router'
import { ToastContextProvider } from './store/ToastContext'
import { ToastProvider } from './components/ui/Toast'
import { useEffect, useState } from 'react'
import { createVisitor } from './api/useVisitor'
import { LangProvider } from './store/LangContext'
import { QueryProvider } from './store/QueryProvider'

// P1-SEC-016 — Clé de stockage du consentement RGPD
const CONSENT_KEY = 'kcb_analytics_consent'

/**
 * Page affichée lors de la maintenance planifiée (VITE_MAINTENANCE_MODE=true).
 * Rendue avant tout provider — aucune dépendance externe.
 *
 * @returns {JSX.Element}
 */
function MaintenancePage() {
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
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</p>
      <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '12px' }}>
        Maintenance en cours
      </h1>
      <p style={{ fontSize: '15px', color: '#9ca3af', maxWidth: '420px', lineHeight: '1.6' }}>
        Kucibok est temporairement indisponible pour une mise à jour. Nous serons de retour très
        prochainement. Merci de votre patience.
      </p>
      <p style={{ marginTop: '32px', fontSize: '13px', color: '#6b7280' }}>kucibok.com</p>
    </div>
  )
}

// Composant principal extrait pour respecter les règles des hooks React
// (pas de hook après un return conditionnel).
function AppContent() {
  const [visitor, setVisitor] = useState(null)
  // null = pas encore décidé, true = accepté, false = refusé
  const [consent, setConsent] = useState(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return null
  })

  // P1-SEC-016 — Tracking visiteur déclenché seulement après consentement explicite
  useEffect(() => {
    if (consent !== true) return

    const addVisitor = async () => {
      let ipAddress = ''
      try {
        const res = await fetch('https://api.ipify.org?format=json')
        const data = await res.json()
        ipAddress = data.ip
      } catch {
        ipAddress = 'Unknown'
      }
      const visitorData = {
        ipAddress,
        userAgent: navigator.userAgent,
        pageVisited: window.location.pathname,
        referrer: document.referrer || 'Direct',
        sessionId: 'session-' + Math.random().toString(36).substring(2, 15),
      }
      try {
        const newVisitor = await createVisitor(visitorData)
        setVisitor(newVisitor)
      } catch {
        // visitor creation is non-blocking
      }
    }

    addVisitor()
  }, [consent])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    setConsent(true)
  }

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'false')
    setConsent(false)
  }

  return (
    <>
      <QueryProvider>
        <LangProvider>
          <ToastProvider>
            <ToastContextProvider>
              <BrowserRouter>
                <Router />
              </BrowserRouter>
            </ToastContextProvider>
          </ToastProvider>
        </LangProvider>
      </QueryProvider>

      {/* P1-SEC-016 — Bandeau de consentement RGPD (affiché tant que l'utilisateur n'a pas décidé) */}
      {consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentement cookies et mesure d'audience"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#1a1a1a',
            color: '#f5f5f5',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            zIndex: 9999,
            fontSize: '14px',
            lineHeight: '1.5',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <p style={{ margin: 0, flex: '1 1 300px' }}>
            Nous utilisons des cookies d'analyse pour mesurer l'audience du site (adresse IP, pages
            visitées). Conformément au RGPD, votre consentement est requis avant toute collecte.{' '}
            <a href="/privacy-policy" style={{ color: '#c9a84c', textDecoration: 'underline' }}>
              En savoir plus
            </a>
          </p>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={handleDecline}
              style={{
                padding: '8px 18px',
                background: 'transparent',
                border: '1px solid #888',
                color: '#ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Refuser
            </button>
            <button
              onClick={handleAccept}
              style={{
                padding: '8px 18px',
                background: '#c9a84c',
                border: 'none',
                color: '#1a1a1a',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
              }}
            >
              Accepter
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function App() {
  // M4 — Maintenance planifiée : VITE_MAINTENANCE_MODE=true coupe l'accès public
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return <MaintenancePage />
  }
  return <AppContent />
}

export default App
