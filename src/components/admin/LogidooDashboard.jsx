import { useState, useEffect } from 'react'
import { utils } from '../../api/useAPI'
import { ErrorState } from '../ui'
import {
  Truck,
  Package,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Bell,
  Eye,
  Trash2,
  TrendingUp,
} from 'lucide-react'

export default function LogidooDashboard() {
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [diag, setDiag] = useState(null) // { title, data } ou { title, error }
  const [diagLoading, setDiagLoading] = useState(false)

  // Appelle l'API logistique ; lève une erreur lisible si elle ne répond pas
  const callApi = async (path, options = {}) => {
    const response = await fetch(`${utils.api}/logistics/${path}`, {
      headers: utils.options.headers,
      ...options,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || `API logistique indisponible (HTTP ${response.status})`)
    }
    return data
  }

  const reload = async () => {
    setError(null)
    await Promise.all([loadAlerts(), loadStats()])
  }

  useEffect(() => {
    reload()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      reload()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadAlerts = async () => {
    try {
      const data = await callApi('alerts?limit=20')
      setAlerts(data.alerts || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await callApi('alerts/stats')
      setStats(data.stats)
    } catch (err) {
      setError(err.message)
    }
  }

  const runAction = async (path, options) => {
    try {
      await callApi(path, options)
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleMarkRead = (alertId) => runAction(`alerts/${alertId}/read`, { method: 'PATCH' })

  const handleMarkAllRead = () => runAction('alerts/read-all', { method: 'PATCH' })

  const handleSync = async () => {
    setSyncing(true)
    await runAction('sync', { method: 'POST' })
    setSyncing(false)
  }

  // Outils Logidoo : test de connexion, forme des réponses, webhooks reçus
  const runDiag = async (title, path) => {
    setDiagLoading(true)
    setDiag(null)
    try {
      const data = await callApi(path)
      setDiag({ title, data })
    } catch (err) {
      setDiag({ title, error: err.message })
    } finally {
      setDiagLoading(false)
    }
  }

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'bg-red-500/20 border-red-500/50 text-red-300',
      warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
      success: 'bg-green-500/20 border-green-500/50 text-green-300',
      info: 'bg-kcb-or/20 border-kcb-or/50 text-kcb-sable',
    }
    return colors[severity] || colors.info
  }

  const getTypeIcon = (type) => {
    const icons = {
      status_change: <RefreshCw className="w-4 h-4" />,
      delivery_exception: <AlertTriangle className="w-4 h-4" />,
      delay: <Clock className="w-4 h-4" />,
      delivered: <CheckCircle className="w-4 h-4" />,
      created: <Package className="w-4 h-4" />,
      cancelled: <Trash2 className="w-4 h-4" />,
    }
    return icons[type] || <Bell className="w-4 h-4" />
  }

  const formatDate = (date) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now - d

    if (diff < 60000) return "À l'instant"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return d.toLocaleDateString('fr-FR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-kcb-pierre">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">🚚 Dashboard Logidoo</h1>
          <p className="text-kcb-pierre mt-1">Suivi des expéditions et alertes en temps réel</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 rounded-[4px] text-kcb-noir font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Synchronisation...' : 'Sync Now'}
        </button>
      </div>

      {/* Intégration Logidoo : vérifier la connexion et relever les schémas réels */}
      <div className="bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06] p-6">
        <h2 className="text-lg font-bold text-white mb-1">Intégration Logidoo</h2>
        <p className="text-sm text-kcb-pierre mb-4">
          Teste la connexion avec le jeton configuré sur le serveur (staging par défaut) et relève la forme des
          réponses, sans afficher de données personnelles.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runDiag('Connexion', 'logidoo/status?check=1')}
            disabled={diagLoading}
            className="px-3 py-2 bg-kcb-or hover:bg-kcb-or/90 rounded-[4px] text-kcb-noir text-sm font-medium transition disabled:opacity-50"
          >
            Tester la connexion
          </button>
          <button
            onClick={() => runDiag('Schémas des réponses', 'logidoo/probe')}
            disabled={diagLoading}
            className="px-3 py-2 bg-kcb-ardoise border border-white/[0.1] hover:border-kcb-or/50 rounded-[4px] text-white text-sm transition disabled:opacity-50"
          >
            Relever les schémas
          </button>
          <button
            onClick={() => runDiag('Webhooks reçus', 'logidoo/webhooks')}
            disabled={diagLoading}
            className="px-3 py-2 bg-kcb-ardoise border border-white/[0.1] hover:border-kcb-or/50 rounded-[4px] text-white text-sm transition disabled:opacity-50"
          >
            Webhooks reçus
          </button>
        </div>
        {diagLoading && <p className="text-sm text-kcb-pierre mt-3">Appel en cours…</p>}
        {diag?.error && (
          <ErrorState className="mt-3" title={`${diag.title} : échec`} error={diag.error} />
        )}
        {diag?.data && (
          <pre className="mt-3 max-h-96 overflow-auto bg-kcb-noir/60 border border-white/[0.06] rounded-[4px] p-3 text-xs text-kcb-sable whitespace-pre-wrap">
            {JSON.stringify(diag.data, null, 2)}
          </pre>
        )}
      </div>

      {error && (
        <ErrorState
          title="Impossible de joindre l'API logistique"
          error={error}
          onRetry={reload}
        />
      )}

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Total alertes"
            value={stats.total}
            icon={<Bell className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            label="Non lues"
            value={stats.unread}
            icon={<AlertTriangle className="w-5 h-5" />}
            color={stats.unread > 0 ? 'yellow' : 'green'}
          />
          <StatCard
            label="Dernières 24h"
            value={stats.last24h}
            icon={<Clock className="w-5 h-5" />}
            color="kcb"
          />
          <StatCard
            label="Taux de succès"
            value={
              stats.bySeverity?.success != null && stats.total > 0
                ? `${((stats.bySeverity.success / stats.total) * 100).toFixed(0)}%`
                : 'N/A'
            }
            icon={<TrendingUp className="w-5 h-5" />}
            color="green"
          />
        </div>
      )}

      {/* Alertes */}
      <div className="bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5" /> Alertes & Notifications
            {stats?.unread > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {stats.unread}
              </span>
            )}
          </h2>
          {stats?.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-kcb-or hover:text-kcb-or/80"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        {alerts.length === 0 && error ? (
          <p className="text-center py-12 text-kcb-pierre">Alertes indisponibles.</p>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-kcb-pierre">Aucune alerte - Tout est en ordre!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-[4px] border ${getSeverityColor(alert.severity)} ${
                  !alert.read ? 'opacity-100' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getTypeIcon(alert.type)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{alert.title}</h3>
                        {!alert.read && <span className="w-2 h-2 bg-kcb-or rounded-full"></span>}
                      </div>
                      <p className="text-sm text-kcb-sable mt-1">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-kcb-pierre">
                        <span>{formatDate(alert.created_at)}</span>
                        {alert.trackingId && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" /> {alert.trackingId}
                          </span>
                        )}
                        {alert.metadata?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {alert.metadata.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!alert.read && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        className="p-2 hover:bg-white/10 rounded transition"
                        title="Marquer comme lu"
                      >
                        <Eye className="w-4 h-4 text-kcb-pierre" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Répartition par type */}
      {stats?.byType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06] p-6">
            <h3 className="text-lg font-bold text-white mb-4">Par type</h3>
            <div className="space-y-3">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-kcb-pierre capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06] p-6">
            <h3 className="text-lg font-bold text-white mb-4">Par sévérité</h3>
            <div className="space-y-3">
              {Object.entries(stats.bySeverity).map(([severity, count]) => (
                <div key={severity} className="flex justify-between items-center">
                  <span
                    className={`capitalize flex items-center gap-2 ${
                      severity === 'critical'
                        ? 'text-red-400'
                        : severity === 'warning'
                          ? 'text-yellow-400'
                          : severity === 'success'
                            ? 'text-green-400'
                            : 'text-kcb-or'
                    }`}
                  >
                    {severity === 'critical' && <AlertTriangle className="w-4 h-4" />}
                    {severity === 'warning' && <Clock className="w-4 h-4" />}
                    {severity === 'success' && <CheckCircle className="w-4 h-4" />}
                    {severity === 'info' && <Bell className="w-4 h-4" />}
                    {severity}
                  </span>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    blue: 'bg-kcb-or/10 border-kcb-or/30',
    green: 'bg-green-500/10 border-green-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
    kcb: 'bg-kcb-bronze/10 border-kcb-bronze/30',
    red: 'bg-red-500/10 border-red-500/30',
  }

  const textColors = {
    blue: 'text-kcb-sable',
    green: 'text-green-300',
    yellow: 'text-yellow-300',
    kcb: 'text-kcb-sable',
    red: 'text-red-300',
  }

  return (
    <div className={`border rounded-[4px] p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-kcb-pierre">{label}</span>
        <span className={textColors[color]}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  )
}
