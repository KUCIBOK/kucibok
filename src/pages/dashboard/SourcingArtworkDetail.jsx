import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  ShieldCheck,
  Heart,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Palette,
  Loader2,
  CheckCircle2,
  Globe,
} from 'lucide-react'
import { getCataloguePro } from '../../api/useSourcing'
import {
  addToShortlistSession,
  removeFromShortlistSession,
} from '../../api/useShortlist'
import { useAuth } from '../../store/AuthContext'
import { canShortlist } from '../../utils/planUtils'
import { ShortlistGate } from '../../components/shared/ShortlistGate'
import { SourcingInquiryModal } from '../../components/artworks/SourcingInquiryModal'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

function validImageUrl(url) {
  if (!url) return null
  if (url.includes('backend.kucibok.com')) return null
  return url
}

function sanitizeHTML(html) {
  // Remove HTML tags and decode entities
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export default function SourcingArtworkDetail() {
  const { artworkId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { subscription, user } = useAuth()
  const dashboardBase = location.pathname.startsWith('/dashboard/advisor')
    ? '/dashboard/advisor'
    : '/dashboard/curator'
  const cataloguePath = `${dashboardBase}?tab=sourcing`
  const canShortlistFeature = canShortlist(subscription)

  const [artwork, setArtwork] = useState(null)
  const [artist, setArtist] = useState(null)
  const [portfolioWorks, setPortfolioWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [isShortlisted, setIsShortlisted] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [shortlistLoading, setShortlistLoading] = useState(false)

  useEffect(() => {
    const fetchArtwork = async () => {
      setLoading(true)
      try {
        // Fetch all works and find the current one
        const result = await getCataloguePro({ page: 1, limit: 100 })
        if (result?.data) {
          const found = result.data.find((w) => w.id === artworkId || w._id === artworkId)
          if (found) {
            setArtwork(found)

            // Fetch artist data using artist_id
            if (found.artist_id) {
              const { data: artistData } = await supabaseClient
                .from('artists')
                .select('*')
                .eq('id', found.artist_id)
                .single()

              if (artistData) {
                setArtist(artistData)
              }
            }

            // Get portfolio works by same artist (excluding current)
            const sameArtist = result.data
              .filter((w) => w.artist_id === found.artist_id && (w.id !== artworkId && w._id !== artworkId))
              .slice(0, 4)
            setPortfolioWorks(sameArtist)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchArtwork()
  }, [artworkId])

  const handleToggleShortlist = async () => {
    setShortlistLoading(true)
    try {
      if (isShortlisted) {
        const result = await removeFromShortlistSession(artworkId)
        if (result.success) setIsShortlisted(false)
      } else {
        const result = await addToShortlistSession(artworkId)
        if (result.success) setIsShortlisted(true)
      }
    } finally {
      setShortlistLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kcb-noir">
        <Loader2 className="w-8 h-8 text-kcb-or animate-spin" />
      </div>
    )
  }

  if (!artwork) {
    return (
      <div className="min-h-screen bg-kcb-noir text-white pt-8 px-4">
        <button
          onClick={() => navigate(cataloguePath, { replace: true })}
          className="flex items-center gap-2 text-kcb-or hover:text-kcb-or/80 mb-8 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <div className="text-center">
          <p className="text-lg font-medium text-white mb-2">Œuvre non trouvée</p>
          <p className="text-kcb-pierre">Cette œuvre n'existe pas ou a été supprimée.</p>
        </div>
      </div>
    )
  }

  const AVAILABILITY_LABELS = {
    available: { label: 'Disponible', color: 'text-green-400 bg-green-900/30 border-green-800/40' },
    on_exhibition: { label: 'En exposition', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/40' },
    on_request: { label: 'Sur demande', color: 'text-kcb-or bg-kcb-or/10 border-kcb-or/30' },
    unavailable: { label: 'Indisponible', color: 'text-red-400 bg-red-900/30 border-red-800/40' },
  }

  const avail = artwork.availabilityStatus
    ? AVAILABILITY_LABELS[artwork.availabilityStatus]
    : null

  return (
    <>
      <div className="min-h-screen bg-kcb-noir text-white pt-8 pb-16">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <button
            onClick={() => navigate(cataloguePath, { replace: true })}
            className="flex items-center gap-2 text-kcb-or hover:text-kcb-or/80 mb-6 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au catalogue
          </button>

          {/* Breadcrumb + Title */}
          <div className="mb-6">
            <p className="text-xs text-kcb-pierre mb-2 uppercase tracking-wide">Sourcing & Vetting</p>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-playfair font-bold text-white mb-2">
                  {artwork.title}
                </h1>
                <p className="text-lg text-kcb-pierre">{artwork.artist}</p>
              </div>
              {artwork.kucibok_id && (
                <div className="flex items-center gap-1 bg-kcb-noir/90 border border-kcb-or/30 rounded-full px-3 py-1.5 whitespace-nowrap">
                  <ShieldCheck className="w-4 h-4 text-kcb-or" />
                  <span className="text-xs text-kcb-or/80 font-mono">{artwork.kucibok_id}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hero + Specs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Image */}
            <div className="lg:col-span-2">
              <div className="relative aspect-square rounded-[8px] overflow-hidden bg-kcb-ardoise border border-white/[0.06] group">
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
                  <div className="w-full h-full flex items-center justify-center text-kcb-pierre text-sm">
                    Pas d'image disponible
                  </div>
                )}
              </div>
            </div>

            {/* Specs Panel */}
            <div className="flex flex-col gap-6">
              {/* Technical Specs */}
              <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[8px] p-5 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-kcb-pierre mb-4">
                  Spécifications
                </h3>

                {artwork.medium && (
                  <div>
                    <p className="text-xs text-kcb-pierre uppercase tracking-wide mb-1">Medium</p>
                    <p className="text-white text-sm font-medium">{artwork.medium}</p>
                  </div>
                )}

                {artwork.dimensions && (
                  <div>
                    <p className="text-xs text-kcb-pierre uppercase tracking-wide mb-1">Dimensions</p>
                    <p className="text-white text-sm font-medium">{artwork.dimensions}</p>
                  </div>
                )}

                {artwork.year && (
                  <div>
                    <p className="text-xs text-kcb-pierre uppercase tracking-wide mb-1">Année</p>
                    <p className="text-white text-sm font-medium">{artwork.year}</p>
                  </div>
                )}

                {artwork.price > 0 && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <p className="text-xs text-kcb-pierre uppercase tracking-wide mb-1">Prix</p>
                    <p className="text-kcb-or text-lg font-semibold">
                      {artwork.price.toLocaleString('fr-FR')} {artwork.currency}
                    </p>
                  </div>
                )}

                {/* Availability Badge */}
                {avail && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <span className={`inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-full border ${avail.color}`}>
                      {avail.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {/* Shortlist Button */}
                {canShortlistFeature ? (
                  <button
                    onClick={handleToggleShortlist}
                    disabled={shortlistLoading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[4px] transition text-sm font-medium ${
                      isShortlisted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                        : 'bg-kcb-or/10 text-kcb-or border border-kcb-or/30 hover:bg-kcb-or/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Heart className={`w-4 h-4 ${isShortlisted ? 'fill-current' : ''}`} />
                    {isShortlisted ? 'Enregistrée' : 'Enregistrer'}
                  </button>
                ) : (
                  <ShortlistGate minimal>
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[4px] bg-kcb-or/20 text-kcb-or opacity-50 cursor-not-allowed text-sm font-medium"
                    >
                      <Heart className="w-4 h-4" />
                      Enregistrer
                    </button>
                  </ShortlistGate>
                )}

                {/* Contact Button */}
                <button
                  onClick={() => setShowContactModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[4px] bg-kcb-or hover:bg-kcb-or/90 text-white transition text-sm font-medium"
                >
                  <Phone className="w-4 h-4" />
                  Demander un appel
                </button>
              </div>

              {/* Trust Signals */}
              <div className="bg-kcb-ardoise/50 border border-white/[0.06] rounded-[8px] p-4 space-y-2">
                <p className="text-xs text-kcb-pierre uppercase tracking-wide font-semibold mb-3">
                  Signaux de confiance
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Identité vérifiée</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Catalogue officiel</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Profil Kucibok actif</span>
                  </div>
                  <div className="flex items-center gap-2 text-kcb-or">
                    <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Sourcing confidentiel</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Artist Card */}
        {artist && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[8px] p-6 sm:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-kcb-pierre mb-6">
                À propos de l'artiste
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {/* Artist Info */}
                <div className="sm:col-span-2 space-y-6">
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-2">{artist.name}</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-kcb-pierre">{artist.country}</span>
                      {artist.years_experience && (
                        <span className="text-sm text-kcb-pierre">
                          · {artist.years_experience}
                          {artist.years_experience > 1 ? ' années' : ' année'} d'expérience
                        </span>
                      )}
                    </div>
                    {artist.tier && (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-1 mt-2 rounded-full bg-kcb-or/10 text-kcb-or border border-kcb-or/30">
                        {artist.tier}
                      </span>
                    )}
                  </div>

                  {artist.disciplines && artist.disciplines.length > 0 && (
                    <div>
                      <p className="text-xs text-kcb-pierre uppercase tracking-wide font-semibold mb-2">
                        Disciplines
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {artist.disciplines.map((disc) => (
                          <span key={disc} className="text-sm text-kcb-sable bg-kcb-noir/40 px-2 py-1 rounded-[4px]">
                            {disc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {artist.biography && (
                    <div>
                      <p className="text-xs text-kcb-pierre uppercase tracking-wide font-semibold mb-2">
                        Bio
                      </p>
                      <p className="text-sm text-white leading-relaxed">
                        {sanitizeHTML(artist.biography)}
                      </p>
                    </div>
                  )}

                  {artist.artistic_statement && (
                    <div>
                      <p className="text-xs text-kcb-pierre uppercase tracking-wide font-semibold mb-2">
                        Démarche
                      </p>
                      <p className="text-sm text-white leading-relaxed italic">{artist.artistic_statement}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
                    {artist.location && (
                      <div>
                        <p className="text-xs text-kcb-pierre uppercase tracking-wide mb-1">Zone de pratique</p>
                        <div className="flex items-center gap-1 text-sm text-white">
                          <MapPin className="w-3.5 h-3.5 text-kcb-or" />
                          {artist.location}
                        </div>
                      </div>
                    )}
                    {artist.market_presence && (
                      <div>
                        <p className="text-xs text-kcb-pierre uppercase tracking-wide mb-1">Présence marché</p>
                        <a
                          href="https://abac.art"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-kcb-or hover:text-kcb-or/80 transition"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {artist.market_presence}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Artist */}
                <div className="bg-kcb-noir/50 border border-white/[0.06] rounded-[4px] p-4 h-fit">
                  <p className="text-xs text-kcb-pierre uppercase tracking-wide font-semibold mb-3">
                    Contact artiste
                  </p>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[4px] bg-kcb-or/10 text-kcb-or border border-kcb-or/30 hover:bg-kcb-or/20 transition text-xs font-medium mb-2"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Contacter
                  </button>
                  <p className="text-xs text-kcb-pierre text-center mt-3">
                    +221 77 837 59 99
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Artwork Description */}
        {artwork?.description && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[8px] p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-white mb-4">À propos de cette œuvre</h3>
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                {sanitizeHTML(artwork.description)}
              </p>
            </div>
          </div>
        )}

        {/* Portfolio */}
        {portfolioWorks.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <h3 className="text-lg font-semibold text-white mb-6">Portfolio sélectionné</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {portfolioWorks.map((work) => (
                <Link
                  key={work.id || work._id}
                    to={`${dashboardBase}/sourcing/${work.id || work._id}`}
                  className="group bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-kcb-or/30 transition flex flex-col h-full"
                >
                  <div className="relative aspect-square overflow-hidden bg-kcb-noir">
                    {validImageUrl(work.image) ? (
                      <img
                        src={validImageUrl(work.image)}
                        alt={work.title}
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
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h4 className="text-sm font-semibold text-white line-clamp-1">
                      {work.title}
                    </h4>
                    {work.year && (
                      <p className="text-xs text-kcb-pierre mt-1">{work.year}</p>
                    )}
                    {work.medium && (
                      <p className="text-xs text-kcb-pierre italic mt-0.5 line-clamp-1">{work.medium}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA Footer */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-12 border-t border-white/[0.06]">
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-white mb-4">Vous souhaitez en discuter?</h3>
            <p className="text-kcb-pierre mb-6 max-w-md mx-auto">
              Un appel avec {artwork.artist} ou avec l'équipe Kucibok Bridge pour voir le travail en détail et
              discuter disponibilité, prix et expédition.
            </p>
            <button
              onClick={() => setShowContactModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[4px] bg-kcb-or hover:bg-kcb-or/90 text-white font-medium transition mb-8"
            >
              <Phone className="w-4 h-4" />
              Demander un appel
            </button>
            <div className="text-xs text-kcb-pierre space-y-1">
              <p>Kucibok Bridge · contact@kucibok.com · +221 77 837 59 99</p>
              <p className="text-[10px]">
                Ce dossier a été assemblé par l'équipe Kucibok Bridge. Toute information est sujette à
                confirmation directe avec l'artiste.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <SourcingInquiryModal
          artwork={artwork}
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </>
  )
}
