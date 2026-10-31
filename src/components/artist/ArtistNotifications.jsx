import { useState, useEffect } from 'react'
import {
  Bell,
  AlertTriangle,
  X,
  Eye,
  Package,
  DollarSign,
  MessageSquare,
  Heart,
  Clock,
} from 'lucide-react'
import { utils } from '../../api/useAPI'
import { ErrorState } from '../ui'
import { useT } from '../../i18n'
import { artistT } from '../../i18n/artist'

export default function ArtistNotifications() {
  const t = useT(artistT).notifications
  const [notifications, setNotifications] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${utils.api}/notifications`, { ...utils.options, method: 'GET' })
        if (!res.ok) throw new Error(`Notifications indisponibles (HTTP ${res.status})`)
        const body = await res.json()
        const list = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : []
        setNotifications(list)
      } catch (err) {
        setLoadError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const filteredNotifications =
    filter === 'all'
      ? notifications
      : filter === 'unread'
        ? notifications.filter((n) => !n.read)
        : notifications.filter((n) => n.read)

  // Appelle l'API puis met à jour la liste locale seulement si le serveur a accepté
  const call = async (path, method) => {
    try {
      const res = await fetch(`${utils.api}/notifications${path}`, { ...utils.options, method })
      return res.ok
    } catch {
      return false
    }
  }

  const handleMarkRead = async (id) => {
    if (await call(`/${id}/read`, 'PATCH'))
      setNotifications((list) => list.map((n) => (n._id === id ? { ...n, read: true } : n)))
  }

  const handleMarkAllRead = async () => {
    if (await call('/read-all', 'PATCH')) setNotifications((list) => list.map((n) => ({ ...n, read: true })))
  }

  const handleDelete = async (id) => {
    if (await call(`/${id}`, 'DELETE')) setNotifications((list) => list.filter((n) => n._id !== id))
  }

  const handleClearAll = async () => {
    if (await call('', 'DELETE')) setNotifications([])
  }

  const getSeverityStyle = (severity) => {
    const styles = {
      success: 'bg-green-500/10 border-green-500/30 text-green-300',
      warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
      info: 'bg-kcb-or/10 border-kcb-or/30 text-kcb-sable',
      critical: 'bg-red-500/10 border-red-500/30 text-red-300',
    }
    return styles[severity] || styles.info
  }

  const getTypeIcon = (type) => {
    const icons = {
      sale: <DollarSign className="w-4 h-4" />,
      bid: <DollarSign className="w-4 h-4" />,
      favorite: <Heart className="w-4 h-4" />,
      message: <MessageSquare className="w-4 h-4" />,
      delivery: <Package className="w-4 h-4" />,
      warning: <AlertTriangle className="w-4 h-4" />,
    }
    return icons[type] || <Bell className="w-4 h-4" />
  }

  return (
    <div className="space-y-6">
      {loadError && <ErrorState title="Impossible de charger les notifications" error={loadError} />}
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">🔔 Notifications</h1>
          <p className="text-kcb-pierre mt-1">
            {unreadCount > 0 ? t.unread(unreadCount) : t.allRead}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 rounded-[4px] text-kcb-noir text-sm font-medium transition"
            >
              {t.markAllRead}
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-[4px] text-sm font-medium transition"
            >
              {t.clearAll}
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {['all', 'unread', 'read'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-[4px] text-sm font-medium transition ${
              filter === f
                ? 'bg-kcb-or text-kcb-noir'
                : 'bg-kcb-ardoise text-kcb-sable hover:bg-white/[0.08]'
            }`}
          >
            {t.filters[f]}
          </button>
        ))}
      </div>

      {/* Liste des notifications */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-kcb-pierre">{t.loading}</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-kcb-ardoise/50 rounded-[4px] border border-white/[0.06]">
          <Bell className="w-12 h-12 text-kcb-pierre mx-auto mb-4" />
          <p className="text-kcb-pierre">
            {t.empty[filter]}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id ?? notification._id}
              className={`p-4 rounded-[4px] border ${getSeverityStyle(notification.severity)} ${
                !notification.read ? 'opacity-100' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getTypeIcon(notification.type)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{notification.title}</h3>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-kcb-or rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-kcb-sable mt-1">{notification.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-kcb-pierre">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {notification.time}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkRead(notification.id ?? notification._id)}
                      className="p-2 hover:bg-white/10 rounded transition"
                      title={t.markRead}
                    >
                      <Eye className="w-4 h-4 text-kcb-pierre" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notification.id ?? notification._id)}
                    className="p-2 hover:bg-white/10 rounded transition"
                    title={t.delete}
                  >
                    <X className="w-4 h-4 text-kcb-pierre" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label={t.stats.sales}
          value={notifications.filter((n) => n.type === 'sale').length}
          icon={<DollarSign className="w-4 h-4" />}
          color="green"
        />
        <StatCard
          label={t.stats.bids}
          value={notifications.filter((n) => n.type === 'bid').length}
          icon={<DollarSign className="w-4 h-4" />}
          color="blue"
        />
        <StatCard
          label={t.stats.messages}
          value={notifications.filter((n) => n.type === 'message').length}
          icon={<MessageSquare className="w-4 h-4" />}
          color="kcb"
        />
        <StatCard
          label={t.stats.favorites}
          value={notifications.filter((n) => n.type === 'favorite').length}
          icon={<Heart className="w-4 h-4" />}
          color="red"
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    green: 'bg-green-500/10 border-green-500/30 text-green-300',
    blue: 'bg-kcb-or/10 border-kcb-or/30 text-kcb-sable',
    kcb: 'bg-kcb-bronze/10 border-kcb-bronze/30 text-kcb-sable',
    red: 'bg-red-500/10 border-red-500/30 text-red-300',
  }

  return (
    <div className={`border rounded-[4px] p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium opacity-75">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
