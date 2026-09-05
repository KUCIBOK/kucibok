/**
 * CuratorCatalogue.jsx — Catalogue adapté aux dashboards
 *
 * Version dashboard-friendly de CataloguePro
 * - Réutilise la logique de recherche/filtrage
 * - Pas de Links (cause "Route not found" dans le dashboard)
 * - Permet le sourcing via SourcingInquiryModal
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck, SlidersHorizontal, Search, X, Loader2, Heart, FileText } from 'lucide-react'
import { getCataloguePro } from '../../api/useSourcing'
import {
  addToShortlistSession,
  removeFromShortlistSession,
} from '../../api/useShortlist'
import { ShortlistGate } from '../shared/ShortlistGate'
import { canShortlist } from '../../utils/planUtils'
import { useAuth } from '../../store/AuthContext'

const AVAILABILITY_LABELS = {
  available: { label: 'Disponible', color: 'text-green-400 bg-green-900/30 border-green-800/40' },
  on_exhibition: { label: 'En exposition', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/40' },
  on_request: { label: 'Sur demande', color: 'text-kcb-or bg-kcb-or/10 border-kcb-or/30' },
  unavailable: { label: 'Indisponible', color: 'text-red-400 bg-red-900/30 border-red-800/40' },
}

const SOLD_LABEL = {
  label: 'Vendu',
  color: 'text-red-300 bg-red-900/30 border-red-700/40',
}

const PRIVATE_COLLECTION_LABEL = {
  label: 'Collection privée',
  color: 'text-kcb-or bg-kcb-or/10 border-kcb-or/30',
}

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Toutes disponibilités' },
  { value: 'available', label: 'Disponible' },
  { value: 'on_exhibition', label: 'En exposition' },
  { value: 'on_request', label: 'Sur demande' },
  { value: 'unavailable', label: 'Indisponible' },
]

const INITIAL_FILTERS = {
  category: '',
  availabilityStatus: '',
  priceMin: '',
  priceMax: '',
  search: '',
  page: 1,
}

function validImageUrl(url) {
  if (!url) return null
  if (url.includes('backend.kucibok.com')) return null
  return url
}

/**
 * ArtworkShortlistButton — Composant pour ajouter/retirer du shortlist
 */
function ArtworkShortlistButton({ artworkId, isShortlisted, onToggle }) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      if (isShortlisted) {
        const result = await removeFromShortlistSession(artworkId)
        if (result.success) {
          onToggle(false)
        }
      } else {
        const result = await addToShortlistSession(artworkId)
        if (result.success) {
          onToggle(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex-1 text-xs py-1.5 rounded-[4px] transition flex items-center justify-center gap-1 ${
        isShortlisted
          ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
          : 'bg-kcb-or/10 text-kcb-or border border-kcb-or/30 hover:bg-kcb-or/20'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Heart className={`w-3 h-3 ${isShortlisted ? 'fill-current' : ''}`} />
      <span>{isShortlisted ? 'Saved' : 'Save'}</span>
    </button>
  )
}

export function CuratorCatalogue() {
  const location = useLocation()
  const dashboardBase = location.pathname.startsWith('/dashboard/advisor')
    ? '/dashboard/advisor'
    : '/dashboard/curator'
  const { subscription } = useAuth()
  const canShortlistFeature = canShortlist(subscription)

  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [pending, setPending] = useState(INITIAL_FILTERS)
  const [catalogue, setCatalogue] = useState({ data: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [shortlistedSet, setShortlistedSet] = useState(new Set()) // Track shortlisted items locally

  const fetchCatalogue = useCallback(async (params) => {
    setLoading(true)
    const result = await getCataloguePro(params)
    if (result?.data) {
      setCatalogue(result)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCatalogue(filters)
  }, [filters, fetchCatalogue])

  // Shuffle artworks randomly
  const shuffledData = () => {
    const arr = [...catalogue.data]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const activeFiltersCount = Object.values({
    availabilityStatus: filters.availabilityStatus,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
  }).filter(Boolean).length

  const handleSearch = (e) => {
    e.preventDefault()
    setFilters({ ...pending, page: 1 })
  }

  const handleApplyFilters = () => {
    setFilters({ ...pending, page: 1 })
    setShowFilters(false)
  }

  const handleResetFilters = () => {
    setPending(INITIAL_FILTERS)
    setFilters(INITIAL_FILTERS)
  }

  return (
    <>
      {/* Barre recherche + filtres */}
      <div className="flex gap-2 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kcb-pierre" />
            <input
              type="text"
              value={pending.search}
              onChange={(e) => setPending({ ...pending, search: e.target.value })}
              placeholder="Rechercher une œuvre, un artiste…"
              className="w-full pl-9 pr-4 py-2 rounded-[4px] bg-kcb-ardoise border border-white/[0.08] text-sm text-white placeholder-kcb-pierre/50 focus:outline-none focus:ring-2 focus:ring-kcb-or transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 text-white text-sm rounded-[4px] transition"
          >
            Rechercher
          </button>
        </form>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-[4px] border text-sm transition ${
            activeFiltersCount > 0
              ? 'border-kcb-or/30 text-kcb-or bg-kcb-or/10'
              : 'border-white/[0.08] text-kcb-pierre hover:text-white hover:border-white/[0.16]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtres
          {activeFiltersCount > 0 && (
            <span className="bg-kcb-or text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Panneau filtres */}
      {showFilters && (
        <div className="mb-6 p-4 rounded-[4px] border border-white/[0.06] bg-kcb-ardoise/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kcb-pierre font-medium">Disponibilité</label>
              <select
                value={pending.availabilityStatus}
                onChange={(e) => setPending({ ...pending, availabilityStatus: e.target.value })}
                className="rounded-[4px] bg-kcb-ardoise border border-white/[0.08] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or transition"
              >
                {AVAILABILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kcb-pierre font-medium">Prix min (€)</label>
              <input
                type="number"
                min={0}
                value={pending.priceMin}
                onChange={(e) => setPending({ ...pending, priceMin: e.target.value })}
                placeholder="0"
                className="rounded-[4px] bg-kcb-ardoise border border-white/[0.08] p-2 text-sm text-white placeholder-kcb-pierre/50 focus:outline-none focus:ring-2 focus:ring-kcb-or transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kcb-pierre font-medium">Prix max (€)</label>
              <input
                type="number"
                min={0}
                value={pending.priceMax}
                onChange={(e) => setPending({ ...pending, priceMax: e.target.value })}
                placeholder="Illimité"
                className="rounded-[4px] bg-kcb-ardoise border border-white/[0.08] p-2 text-sm text-white placeholder-kcb-pierre/50 focus:outline-none focus:ring-2 focus:ring-kcb-or transition"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-sm text-kcb-pierre hover:text-white transition"
            >
              <X className="w-4 h-4" /> Réinitialiser
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-kcb-or hover:bg-kcb-or/90 text-white text-sm rounded-[4px] transition"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}

      {/* Compteur */}
      {!loading && (
        <p className="text-sm text-kcb-pierre mb-4">
          {catalogue.total} œuvre{catalogue.total !== 1 ? 's' : ''} certifiée
          {catalogue.total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Grille artworks */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-kcb-or animate-spin" />
        </div>
      ) : catalogue.data.length === 0 ? (
        <div className="text-center py-20 text-kcb-pierre">
          <p className="text-lg font-medium text-white mb-2">Aucune œuvre trouvée</p>
          <p className="text-sm">Modifiez vos filtres ou revenez plus tard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {shuffledData().map((artwork) => {
            const isSold = artwork.sold === true || artwork.status === 'sold'
            const artistName = artwork.artist?.trim?.() || ''
            const isPrivateCollection = ['unknown', 'unknown artist'].includes(artistName.toLowerCase())
            const availabilityStatus = artwork.availabilityStatus || artwork.availability_status
            const avail = isPrivateCollection
              ? PRIVATE_COLLECTION_LABEL
              : isSold
              ? SOLD_LABEL
              : availabilityStatus
                ? AVAILABILITY_LABELS[availabilityStatus]
              : null
            return (
              <div
                key={artwork._id}
                className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-kcb-or/30 transition group flex flex-col"
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-kcb-noir">
                  {validImageUrl(artwork.image) ? (
                    <img
                      src={validImageUrl(artwork.image)}
                      alt={artwork.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = '/images/placeholder-artwork.svg'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-kcb-pierre text-xs">
                      Pas d'image
                    </div>
                  )}
                  {/* Badge KCB */}
                  {artwork.kucibok_id && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-kcb-noir/90 border border-kcb-or/30 rounded-full px-2 py-0.5">
                      <ShieldCheck className="w-3 h-3 text-kcb-or" />
                      <span className="text-[10px] text-kcb-or/80 font-mono">
                        {artwork.kucibok_id}
                      </span>
                    </div>
                  )}
                  {/* Badge dispo */}
                  {avail && (
                    <span
                      className={`absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full border font-medium ${avail.color}`}
                    >
                      {avail.label}
                    </span>
                  )}
                </div>

                {/* Infos */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-1">
                    {artwork.title}
                  </h3>
                  {isPrivateCollection ? (
                    <p className="text-kcb-or text-xs mt-0.5">Collection privée</p>
                  ) : (
                    <p className="text-kcb-pierre text-xs mt-0.5">{artwork.artist}</p>
                  )}
                  {artwork.medium && (
                    <p className="text-kcb-pierre text-xs mt-0.5 italic">{artwork.medium}</p>
                  )}

                  {/* Actions */}
                  <div className="mt-auto pt-3 flex gap-2">
                    {/* Shortlist Button */}
                    {canShortlistFeature && !isSold ? (
                      <ArtworkShortlistButton
                        artworkId={artwork.id}
                        isShortlisted={shortlistedSet.has(artwork.id)}
                        onToggle={(isNow) => {
                          const newSet = new Set(shortlistedSet)
                          if (isNow) newSet.add(artwork.id)
                          else newSet.delete(artwork.id)
                          setShortlistedSet(newSet)
                        }}
                      />
                    ) : isSold ? (
                      <span className="flex-1 text-center text-xs py-1.5 rounded-[4px] border border-red-700/30 text-red-300">
                        Vendu
                      </span>
                    ) : (
                      <ShortlistGate minimal>
                        <button
                          disabled
                          className="flex-1 text-xs py-1.5 rounded-[4px] bg-kcb-or/20 text-kcb-or opacity-50 cursor-not-allowed transition"
                        >
                          <Heart className="w-3 h-3 inline mr-1" />
                          Save
                        </button>
                      </ShortlistGate>
                    )}

                    {/* Detail Link Button */}
                    <Link
                      to={`${dashboardBase}/sourcing/${artwork.id || artwork._id}`}
                      className="flex-1 text-xs py-1.5 rounded-[4px] bg-kcb-or hover:bg-kcb-or/90 text-white transition flex items-center justify-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      Détails
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {catalogue.pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            className="px-3 py-1.5 text-sm rounded-[4px] border border-white/[0.08] text-kcb-sable hover:text-white disabled:opacity-40 transition"
          >
            Précédent
          </button>
          <span className="px-3 py-1.5 text-sm text-kcb-pierre">
            {filters.page} / {catalogue.pages}
          </span>
          <button
            disabled={filters.page >= catalogue.pages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            className="px-3 py-1.5 text-sm rounded-[4px] border border-white/[0.08] text-kcb-sable hover:text-white disabled:opacity-40 transition"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Note: Modal sourcing removed — use detail page instead */}
    </>
  )
}
