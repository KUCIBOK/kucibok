import './index.css'
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import Error500 from './components/fallback/Error500'
import { ErrorBoundaryWithNotificationsWrapper } from './components/fallback/ErrorBoundaryWithNotifications'

// Initialize Sentry for error tracking in production
// Uses VITE_SENTRY_DSN environment variable. In local dev you can set
// VITE_SENTRY_DSN in .env, and in Vercel set it as a Project Environment Variable.
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Tracing: sample a small portion in prod (adjust as needed).
    tracesSampleRate: 0.1,
    // Session Replay (sample rates)
    replaysSessionSampleRate: 0.05, // sample 5% of sessions in prod
    replaysOnErrorSampleRate: 1.0, // capture full session when an error occurs
    // Enable logs to be forwarded to Sentry
    enableLogs: true,
    // Integrations: browser tracing and replay (SDK helper functions)
    integrations: [
      // Use the built-in helpers — these are safe across @sentry/react versions
      Sentry.browserTracingIntegration && Sentry.browserTracingIntegration(),
      Sentry.replayIntegration && Sentry.replayIntegration(),
    ].filter(Boolean),
    // Optional: drop noisy events (example: extension SecurityError)
    beforeSend(event) {
      if (
        event.exception?.values?.[0]?.type === 'SecurityError' &&
        event.exception.values[0].value?.includes('access to localStorage')
      ) {
        return null
      }
      return event
    },
  })
}

const App = lazy(() => import('./App'))

// Sentry ErrorBoundary wrapper
const AppWithSentry = Sentry.withProfiler(App)

function AppFallback({ error }) {
  return (
    <BrowserRouter>
      <Error500 error={error} />
    </BrowserRouter>
  )
}

// Sentry ErrorBoundary captures React errors
const SentryErrorBoundary = Sentry.ErrorBoundary

createRoot(document.getElementById('root')).render(
  <SentryErrorBoundary
    fallback={<AppFallback />}
    showDialog={{
      title: 'Erreur inattendue',
      subtitle: 'Nous avons été notifiés. Merci de recharger la page.',
      labelComments: 'Décrivez ce qui s\'est passé',
      labelClose: 'Fermer',
      onClose: () => window.location.reload(),
    }}
  >
    <ErrorBoundaryWithNotificationsWrapper>
      <ErrorBoundary FallbackComponent={AppFallback}>
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0f0f' }} />}>
          <AppWithSentry />
        </Suspense>
      </ErrorBoundary>
    </ErrorBoundaryWithNotificationsWrapper>
  </SentryErrorBoundary>
)
