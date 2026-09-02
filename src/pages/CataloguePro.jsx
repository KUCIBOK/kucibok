import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, SlidersHorizontal, Search, X, Loader2, ArrowLeft, Lock } from 'lucide-react'
import { getCataloguePro } from '../api/useSourcing'
import { SourcingInquiryModal } from '../components/artworks/SourcingInquiryModal'
import { Helmet } from 'react-helmet'
import { useSubscription } from '../api/useSubscriptionQuery' /* ✨ React Query */

const AVAILABILITY_LABELS = {
  available: { label: 'Disponible', color: 'text-green-400 bg-green-900/30 border-green-800/40' },
  on_exhibition: {
    label: 'En exposition',
    color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/40',
  },
  on_request: { label: 'Sur demande', color: 'text-kcb-or bg-kcb-or/10 border-kcb-or/30' },
  unavailable: { label: 'Indisponible', color: 'text-red-400 bg-red-900/30 border-red-800/40' },
}

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Toutes disponibilités' },
  { value: 'available', label: 'Disponible' },
  { value: 'on_exhibition', label: 'En exposition' },
  { value: 'on_request', label: 'Sur demande' },
  { value: 'unavailable', label: 'Indisponible' },
]

function validImageUrl(url) {
  if (!url) return null
  if (url.includes('backend.kucibok.com')) return null
  return url
}

const INITIAL_FILTERS = {
  category: '',
  availabilityStatus: '',
  priceMin: '',
  priceMax: '',
  search: '',
  page: 1,
}

/**
 * Page Catalogue Certifié — accès professionnel + admin (F3).
 * Permet aux galeries et curateurs de consulter le catalogue B2B
 * et de soumettre des demandes de mise en relation.
 */
function SubscriptionGate() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-kcb-noir px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-kcb-or/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-kcb-or/70" />
        </div>
        <div>
          <p className="text-white font-semibold text-xl mb-2">Catalogue B2B — Accès réservé</p>
          <p className="text-kcb-pierre text-sm">
            Le catalogue professionnel est accessible aux curateurs et galeries disposant d'un
            abonnement actif.
          </p>
        </div>
        <Link
          to="/global#pricing"
          className="flex items-center gap-2 bg-kcb-or text-kcb-noir px-6 py-2.5 rounded-[4px] text-sm font-semibold hover:bg-kcb-bronze transition"
        >
          Voir les plans
        </Link>
        <Link
          to="/dashboard/curator"
          className="text-sm text-kcb-pierre hover:text-white transition flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}

export default function CataloguePro() {
  const { data: subscription } = useSubscription() /* ✨ React Query */
  const isSubscriptionActive = subscription?.status === 'active'

  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [pending, setPending] = useState(INITIAL_FILTERS)
  const [catalogue, setCatalogue] = useState({ data: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [selectedArtwork, setSelectedArtwork] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

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

  const handleApplyFilters = () => {
    setFilters({ ...pending, page: 1 })
    setShowFilters(false)
  }

  const handleResetFilters = () => {
    setPending(INITIAL_FILTERS)
    setFilters(INITIAL_FILTERS)
    setShowFilters(false)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setFilters({ ...filters, search: pending.search, page: 1 })
  }

  const activeFiltersCount = [
    filters.category,
    filters.availabilityStatus,
    filters.priceMin,
    filters.priceMax,
  ].filter(Boolean).length

  if (!isSubscriptionActive) return <SubscriptionGate />

  return (
    <>
      <Helmet>
        <title>Catalogue Certifié | Kucibok Pro</title>
        <meta
          name="description"
          content="Catalogue B2B d'œuvres certifiées Standard Kucibok — accès professionnel."
        />
      </Helmet>
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to={-1}
            className="flex items-center gap-2 text-kcb-pierre hover:text-white text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-white mb-1">Catalogue Certifié</h1>
              <p className="text-kcb-pierre text-sm">
                Œuvres certifiées Standard Kucibok — accès réservé aux professionnels
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ShieldCheck className="w-6 h-6 text-kcb-or" />
              <span className="text-xs text-kcb-or/80 font-medium hidden sm:block">B2B Pro</span>
            </div>
          </div>
        </div>

        {/* Barre de recherche + filtres */}
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
          <div className="mb-6 p-4 rounded-[4px] border border-white/[0.06] bg-kcb-ardoise/80 animate-fade-in">
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

        {/* Compteur résultats */}
        {!loading && (
          <p className="text-sm text-kcb-pierre mb-4">
            {catalogue.total} œuvre{catalogue.total !== 1 ? 's' : ''} certifiée
            {catalogue.total !== 1 ? 's' : ''}
          </p>
        )}

        {/* Grille */}
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
            {catalogue.data.map((artwork) => {
              const avail = artwork.availabilityStatus
                ? AVAILABILITY_LABELS[artwork.availabilityStatus]
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
                    {/* Badge Standard Kucibok */}
                    {artwork.kucibok_id && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-kcb-noir/90 border border-kcb-or/30 rounded-full px-2 py-0.5">
                        <ShieldCheck className="w-3 h-3 text-kcb-or" />
                        <span className="text-[10px] text-kcb-or/80 font-mono">
                          {artwork.kucibok_id}
                        </span>
                      </div>
                    )}
                    {/* Badge disponibilité */}
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
                    <p className="text-kcb-pierre text-xs mt-0.5">{artwork.artist}</p>
                    {artwork.medium && (
                      <p className="text-kcb-pierre text-xs mt-0.5 italic">{artwork.medium}</p>
                    )}
                    {artwork.price > 0 && (
                      <p className="text-white text-sm font-medium mt-2">
                        {artwork.price.toLocaleString('fr-FR')} {artwork.currency}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto pt-3">
                      <Link
                        to={`/artwork/${artwork._id}`}
                        className="flex-1 text-center text-xs py-1.5 rounded-[4px] border border-white/[0.08] text-kcb-sable hover:border-white/[0.16] hover:text-white transition"
                      >
                        Voir
                      </Link>
                      <button
                        onClick={() => setSelectedArtwork(artwork)}
                        className="flex-1 text-xs py-1.5 rounded-[4px] bg-kcb-or hover:bg-kcb-or/90 text-white transition"
                      >
                        Contacter
                      </button>
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
      </main>

      {/* Modal sourcing */}
      {selectedArtwork && (
        <SourcingInquiryModal
          artwork={selectedArtwork}
          isOpen={!!selectedArtwork}
          onClose={() => setSelectedArtwork(null)}
        />
      )}
    </>
  )
}
