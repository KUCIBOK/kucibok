import { useState, useEffect, useCallback } from 'react'
import {
  Scan,
  Plus,
  X,
  Loader2,
  CheckCircle,
  Clock,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import {
  getMyNumerisationRequests,
  createNumerisation,
  deleteNumerisationRequest,
} from '../../api/useNumerisation'
import { useMyArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */
import { KPICard } from '../ui'

/** Badge de statut coloré pour une demande de numérisation. */
function StatusBadge({ status }) {
  const CONFIG = {
    pending: {
      label: 'En attente',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    processing: { label: 'En cours', className: 'bg-kcb-or/20 text-kcb-or border-kcb-or/30' },
    delivered: {
      label: 'Terminée',
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
  }
  const cfg = CONFIG[status] ?? {
    label: status,
    className: 'bg-gray-500/20 text-kcb-pierre border-gray-500/30',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

/**
 * Onglet de numérisation pour le dashboard Artiste.
 * Permet de consulter l'historique de ses demandes et d'en créer de nouvelles.
 *
 * @returns {JSX.Element}
 */
export function ArtistNumerisationTab() {
  const { myArtworks, loading: artworksLoading } = useMyArtworks() /* ✨ React Query */

  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [formError, setFormError] = useState(null)

  const [form, setForm] = useState({
    artworkId: '',
    artworkTitle: '',
    notes: '',
    priority: 'normal',
  })

  /** Charge les demandes de numérisation de l'artiste connecté. */
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true)
    setError(null)
    const data = await getMyNumerisationRequests()
    if (data?.error) {
      setError(data.error)
    } else {
      setRequests(Array.isArray(data) ? data : [])
    }
    setRequestsLoading(false)
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  /** Met à jour artworkTitle en synchronisation avec artworkId sélectionné. */
  const handleArtworkChange = (e) => {
    const selectedId = e.target.value
    const artwork = myArtworks?.find((a) => (a.id || a._id) === selectedId)
    setForm((prev) => ({
      ...prev,
      artworkId: selectedId,
      artworkTitle: artwork?.title ?? '',
    }))
  }

  /** Soumet le formulaire de nouvelle demande. */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!form.artworkId) {
      setFormError('Veuillez sélectionner une œuvre.')
      return
    }

    setSubmitting(true)
    const result = await createNumerisation({
      artworkTitle: form.artworkTitle,
      artworkId: form.artworkId,
      notes: form.notes,
      priority: form.priority,
    })

    if (result?.error) {
      setFormError(result.error)
      setSubmitting(false)
      return
    }

    // Réinitialise et recharge
    setForm({ artworkId: '', artworkTitle: '', notes: '', priority: 'normal' })
    setShowForm(false)
    setSubmitting(false)
    await fetchRequests()
  }

  /** Supprime une demande si elle est encore en attente. */
  const handleDelete = async (id) => {
    setDeletingId(id)
    const result = await deleteNumerisationRequest(id)
    if (!result?.error) {
      setRequests((prev) => prev.filter((r) => r._id !== id))
    }
    setDeletingId(null)
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const total = requests.length
  const pending = requests.filter((r) => r.status === 'pending').length
  const processing = requests.filter((r) => r.status === 'processing').length
  const delivered = requests.filter((r) => r.status === 'delivered').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-kcb-or/10 text-kcb-or p-2.5 rounded-[4px]">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Numérisation</h2>
            <p className="text-sm text-kcb-pierre">Gérez vos demandes de numérisation d'œuvres</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRequests}
            className="p-2 text-kcb-pierre hover:text-white hover:bg-kcb-ardoise rounded-[4px] transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowForm(true)
              setFormError(null)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 text-kcb-noir text-sm font-medium rounded-[4px] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle demande
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Scan}
          label="Total demandes"
          value={requestsLoading ? '—' : total}
          loading={requestsLoading}
          iconColor="text-kcb-or"
          iconBgColor="bg-kcb-or/10"
        />
        <KPICard
          icon={Clock}
          label="En attente"
          value={requestsLoading ? '—' : pending}
          loading={requestsLoading}
          iconColor="text-yellow-400"
          iconBgColor="bg-yellow-900/20"
        />
        <KPICard
          icon={RefreshCw}
          label="En cours"
          value={requestsLoading ? '—' : processing}
          loading={requestsLoading}
          iconColor="text-kcb-or"
          iconBgColor="bg-kcb-or/10"
        />
        <KPICard
          icon={CheckCircle}
          label="Terminées"
          value={requestsLoading ? '—' : delivered}
          loading={requestsLoading}
          iconColor="text-green-400"
          iconBgColor="bg-green-900/20"
        />
      </div>

      {/* Formulaire inline */}
      {showForm && (
        <div className="bg-[#13161e] border border-white/[0.06] rounded-[4px] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Nouvelle demande de numérisation</h3>
            <button
              onClick={() => {
                setShowForm(false)
                setFormError(null)
              }}
              className="text-kcb-pierre hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sélection de l'œuvre */}
            <div>
              <label className="block text-sm font-medium text-kcb-sable mb-1.5">
                Œuvre <span className="text-red-400">*</span>
              </label>
              <select
                value={form.artworkId}
                onChange={handleArtworkChange}
                className="w-full bg-kcb-ardoise border border-white/[0.06] text-white rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:border-kcb-or transition-colors"
              >
                <option value="">Sélectionner une œuvre…</option>
                {myArtworks?.map((artwork) => (
                  <option key={artwork.id ?? artwork._id} value={artwork.id ?? artwork._id}>
                    {artwork.title}
                    {artwork.kucibok_id ? ` — ${artwork.kucibok_id}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Priorité */}
            <div>
              <label className="block text-sm font-medium text-kcb-sable mb-1.5">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full bg-kcb-ardoise border border-white/[0.06] text-white rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:border-kcb-or transition-colors"
              >
                <option value="normal">Normale</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-kcb-sable mb-1.5">
                Notes (optionnel)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Instructions particulières, contexte de l'œuvre…"
                rows={3}
                className="w-full bg-kcb-ardoise border border-white/[0.06] text-white rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:border-kcb-or transition-colors resize-none placeholder-kcb-pierre"
              />
            </div>

            {/* Erreur formulaire */}
            {formError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-[4px] px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-kcb-or hover:bg-kcb-or/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-[4px] transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {submitting ? 'Envoi…' : 'Soumettre la demande'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormError(null)
                }}
                className="px-5 py-2 bg-kcb-ardoise hover:bg-white/[0.08] text-white text-sm font-medium rounded-[4px] transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Erreur de chargement */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-[4px] px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Liste des demandes */}
      <div className="bg-[#13161e] border border-white/[0.06] rounded-[4px] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Scan className="w-4 h-4 text-kcb-pierre" />
            Historique des demandes
          </h3>
        </div>

        {requestsLoading || artworksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-kcb-or" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <Scan className="w-10 h-10 text-kcb-pierre mb-3" />
            <p className="text-kcb-pierre font-medium">Aucune demande de numérisation</p>
            <p className="text-kcb-pierre text-sm mt-1">
              Cliquez sur «&nbsp;Nouvelle demande&nbsp;» pour commencer.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {requests.map((req) => (
              <div
                key={req._id}
                className="flex items-center justify-between px-6 py-4 hover:bg-kcb-ardoise/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {req.artworkTitle || 'Œuvre sans titre'}
                  </p>
                  <p className="text-kcb-pierre text-xs mt-0.5">
                    {req.created_at
                      ? new Date(req.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                    {req.priority === 'urgent' && (
                      <span className="ml-2 text-kcb-alerte font-medium">· Urgent</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <StatusBadge status={req.status} />
                  {req.status === 'pending' && (
                    <button
                      onClick={() => handleDelete(req._id)}
                      disabled={deletingId === req._id}
                      className="p-1.5 text-kcb-pierre hover:text-red-400 hover:bg-red-900/20 rounded-[4px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Supprimer la demande"
                    >
                      {deletingId === req._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
