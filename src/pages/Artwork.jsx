import {
  ArrowLeft,
  Image,
  Share,
  ShoppingCart,
  Volume2,
  Truck,
  ShieldCheck,
  X,
  FileText,
  Clock,
  Zap,
  Ship,
} from 'lucide-react'
import DOMPurify from 'dompurify'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import { getArtworkById } from '../api/useArtworks'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext' // ⏳ Kept for now (fallback)
import { useAuthUser } from '../api/useAuthUser' // ✨ New: React Query
import { useArtworks } from '../store/ArtworkContext'
import { getArtistById } from '../api/useArtists'
import { Skeleton, SkeletonCard } from '../components/ui'
import { Helmet } from 'react-helmet'
import { RequestShipmentModal } from '../components/artworks/RequestShipmentModal'
import { ArtworkCard } from '../components/artworks/ArtworkCard'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import { utils } from '../api/useAPI'

/** Maximum number of cards per recommendation section. */
const RECO_LIMIT = 4

const SHIPMENT_OPTIONS = [
  { key: 'standard', icon: Ship, label: 'Standard', days: '8–12 jours', factor: 1.0 },
  { key: 'express', icon: Truck, label: 'Express', days: '3–5 jours', factor: 2.1 },
  { key: 'priority', icon: Zap, label: 'Prioritaire', days: '1–2 jours', factor: 3.7 },
]

function simShipmentPrices(artwork) {
  const price = artwork?.price || 0
  const currency = artwork?.currency || 'XOF'
  const priceEur = currency === 'XOF' ? price / 655.957 : currency === 'USD' ? price / 1.09 : price
  const size = priceEur < 100 ? 1 : priceEur < 500 ? 1.25 : priceEur < 2000 ? 1.6 : 2.1
  return SHIPMENT_OPTIONS.map((o) => ({
    ...o,
    eur: Math.round(180 * o.factor * size),
  }))
}

export default function Artwork() {
  const [artwork, setArtwork] = useState({ loading: true, artist: null })
  const [shipmentOpen, setShipmentOpen] = useState(false)
  const [shipSimOpen, setShipSimOpen] = useState(false)
  const [certUrl, setCertUrl] = useState(null)
  const [certLoading, setCertLoading] = useState(false)
  const { id } = useParams()
  const { makeToast } = useToast()
  const { data: user } = useAuthUser() // ✨ Migrated to React Query
  const { forSale } = useArtworks()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const portal = pathname.startsWith('/global') ? '/global' : '/africa'

  useEffect(() => {
    window.scrollTo(0, 0)
    const fetchArtwork = async () => {
      const data = await getArtworkById(id)
      if (data?._id) {
        setArtwork((prev) => ({ ...data, loading: false }))
        if (data?.artist_id) {
          const artistData = await getArtistById(data.artist_id)
          if (artistData?._id) {
            setArtwork((prev) => ({ ...prev, artist: artistData }))
          }
        }
        return
      }
      makeToast('Erreur', 'warning', data?.error)
    }
    fetchArtwork()
  }, [id])

  /** Other works by the same artist (exclude current). */
  const sameArtist = useMemo(() => {
    const artistId = artwork?.artist_id || artwork?.artistId
    if (!artistId || !forSale?.length) return []
    return forSale
      .filter(
        (a) => (a.artist_id === artistId || a.artistId === artistId) && (a._id || a.id) !== id
      )
      .slice(0, RECO_LIMIT)
  }, [artwork, forSale, id])

  /** Similar works — same category, different artist. */
  const similar = useMemo(() => {
    const category = artwork?.category
    const artistId = artwork?.artist_id || artwork?.artistId
    if (!category || !forSale?.length) return []
    return forSale
      .filter(
        (a) =>
          a.category === category &&
          (a._id || a.id) !== id &&
          a.artist_id !== artistId &&
          a.artistId !== artistId
      )
      .slice(0, RECO_LIMIT)
  }, [artwork, forSale, id])

  const fetchCertUrl = useCallback(async () => {
    if (certUrl || certLoading || !artwork?._id) return
    setCertLoading(true)
    try {
      const res = await fetch(`${utils.api}/certificates/url/${artwork._id}`, utils.options)
      const body = await res.json()
      if (body?.data?.certificate_url) setCertUrl(body.data.certificate_url)
    } catch {
      // cert URL is optional
    }
    setCertLoading(false)
  }, [artwork?._id, certUrl, certLoading])

  const launchDescriptionSpeech = () => {
    try {
      const description = document.getElementById('artwork-description').textContent
      const utterance = new SpeechSynthesisUtterance(description)
      utterance.lang = 'fr-FR'
      const voices = window.speechSynthesis.getVoices()
      const frVoice = voices.find((v) => v.lang === 'fr-FR')
      if (frVoice) utterance.voice = frVoice
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      // lecture vocale non disponible sur ce navigateur
    }
  }

  return (
    <>
      <Helmet>
        <title>{artwork.title ? `${artwork.title} | Kucibok` : 'Kucibok'}</title>
        <meta name="description" content={artwork.description || ''} />
        <meta property="og:title" content={artwork.title || 'Kucibok'} />
        <meta property="og:description" content={artwork.description || ''} />
        <meta property="og:image" content={artwork.image || ''} />
        <meta property="og:url" content={`https://kucibok.com/artwork/${artwork._id || ''}`} />
        <meta property="og:type" content="product" />
        {artwork?.kucibok_id && (
          <meta property="product:retailer_item_id" content={artwork.kucibok_id} />
        )}
      </Helmet>
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-kcb-pierre hover:text-white text-sm font-medium transition"
          >
            <ArrowLeft className="w-5 h-5" /> Retour
          </button>
        </div>
        {artwork?.loading && (
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            {/* Image skeleton */}
            <div className="md:w-7/12 w-full">
              <SkeletonCard hasImage className="aspect-square" />
            </div>
            {/* Info skeleton */}
            <div className="flex-1 flex flex-col gap-4">
              <Skeleton width="w-3/4" height="h-9" />
              <Skeleton width="w-1/2" height="h-5" />
              <div className="space-y-2 mt-2">
                <Skeleton width="w-full" height="h-4" />
                <Skeleton width="w-full" height="h-4" />
                <Skeleton width="w-2/3" height="h-4" />
              </div>
              <Skeleton width="w-1/3" height="h-10" className="mt-4" />
            </div>
          </div>
        )}
        {artwork?._id && !artwork.loading && (
          <>
            <RevealOnScroll>
              <section className="w-full">
                <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                  {/* IMAGE + SHARE */}
                  <div className="md:w-7/12 w-full flex flex-col items-center md:items-start">
                    <div className="relative w-full max-w-full md:max-w-lg aspect-square rounded-[4px] overflow-hidden border border-white/[0.06] bg-kcb-noir shadow-lg">
                      <img
                        src={artwork?.image}
                        alt={artwork?.title}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                        onError={(e) => {
                          e.target.src = '/images/placeholder-artwork.svg'
                        }}
                      />
                      <button
                        className="absolute top-3 right-3 bg-kcb-ardoise/80 hover:bg-kcb-noir/90 rounded-full p-2 text-kcb-sable border border-white/[0.06] shadow"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href)
                          makeToast('Lien copié !', 'success')
                        }}
                        title="Partager"
                      >
                        <Share className="w-5 h-5" />
                      </button>
                      {/* Certification badge */}
                      {artwork?.kucibok_id && (
                        <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-kcb-noir/80 backdrop-blur-sm text-[10px] font-semibold tracking-[0.08em] uppercase text-kcb-or px-2.5 py-1 rounded-full border border-kcb-or/20">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {artwork.kucibok_id}
                        </span>
                      )}
                    </div>
                    {artwork?.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {artwork.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="rounded-[4px] px-3 py-1 text-xs border border-white/[0.06] text-kcb-sable font-medium bg-kcb-ardoise"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* INFOS */}
                  <div className="flex-1 flex flex-col gap-6 justify-between">
                    <div>
                      {(() => {
                        const artistName =
                          artwork?.artist?.name ||
                          artwork?.artists?.name ||
                          (typeof artwork?.artist === 'string' ? artwork.artist : null)
                        const artistImg = artwork?.artist?.image || artwork?.artists?.image
                        const artistId = artwork?.artist?._id || artwork?.artists?.id
                        return (
                          <div className="flex items-start gap-3 mb-4">
                            {artistImg && (
                              <Link to={`${portal}/artist/${artistId}`} className="shrink-0">
                                <img
                                  src={artistImg}
                                  alt={artistName}
                                  className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-kcb-or/30 shadow"
                                />
                              </Link>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h1 className="font-playfair text-2xl md:text-4xl font-bold text-white mb-1 leading-tight tracking-tight">
                                  {artwork?.title}
                                </h1>
                                <button
                                  onClick={launchDescriptionSpeech}
                                  className="shrink-0 p-2 rounded-[4px] bg-white/10 hover:bg-white/20 text-white transition"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </button>
                              </div>
                              {artistName && (
                                <span className="text-kcb-pierre text-sm flex flex-wrap items-center gap-1">
                                  par <span className="text-white font-semibold">{artistName}</span>{' '}
                                  <span className="inline-block bg-green-600/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full">
                                    Artiste vérifié
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Purchase box */}
                      <div className="border border-kcb-or/20 rounded-[4px] p-4 md:p-6 bg-kcb-ardoise flex flex-col gap-3 shadow-xl mt-2">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                          <span className="font-playfair text-xl md:text-2xl text-white font-semibold">
                            {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: artwork?.currency || 'XOF',
                            }).format(artwork?.price || 0)}
                          </span>
                          <Link
                            to={`/artwork-checkout/${artwork?._id}`}
                            className="rounded-[4px] bg-kcb-or text-sm hover:bg-kcb-bronze transition text-kcb-noir font-semibold px-5 py-2.5 flex items-center gap-2 shadow focus:outline-none focus:ring-2 focus:ring-kcb-or uppercase tracking-[0.05em]"
                          >
                            <ShoppingCart className="w-4 h-4" /> Acheter maintenant
                          </Link>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 text-xs text-kcb-pierre">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                            Paiement sécurisé
                          </span>
                          {artwork?.kucibok_id && (
                            <span className="flex items-center gap-1.5 text-xs text-kcb-or">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Certifié authentique
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mt-6">
                        <h2 className="text-lg font-semibold text-white mb-1">Détails</h2>
                        <ul className="text-sm text-kcb-sable space-y-1">
                          <li className="flex justify-between">
                            <span>Artiste</span>
                            <span className="text-white">
                              {artwork?.artist?.name ||
                                artwork?.artists?.name ||
                                (typeof artwork?.artist === 'string' ? artwork.artist : '—')}
                            </span>
                          </li>
                          <li className="flex justify-between">
                            <span>Créé le</span>
                            <span className="text-white">
                              {artwork?.created_at || artwork?.created
                                ? new Date(
                                    artwork.created_at || artwork.created
                                  ).toLocaleDateString('fr-FR')
                                : '—'}
                            </span>
                          </li>
                          <li className="flex justify-between">
                            <span>Catégorie</span>
                            <span className="text-white">{artwork?.category || '—'}</span>
                          </li>
                          <li className="flex justify-between items-center">
                            <span>Certificat</span>
                            <span>
                              {artwork?.certificate_path ? (
                                certUrl ? (
                                  <a
                                    href={certUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-kcb-or underline"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> Voir le certificat
                                  </a>
                                ) : (
                                  <button
                                    onClick={fetchCertUrl}
                                    disabled={certLoading}
                                    className="flex items-center gap-1 text-kcb-or underline disabled:opacity-60"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    {certLoading ? 'Chargement…' : 'Voir le certificat'}
                                  </button>
                                )
                              ) : artwork?.status === 'approved' ? (
                                <span className="text-kcb-pierre italic text-xs">
                                  Génération en cours…
                                </span>
                              ) : (
                                <span className="text-kcb-pierre italic text-xs">À venir</span>
                              )}
                            </span>
                          </li>
                        </ul>
                      </div>

                      {/* Description */}
                      <div className="mt-4">
                        <h2 className="text-lg font-semibold text-white mb-1">Description</h2>
                        <p
                          id="artwork-description"
                          className="text-kcb-sable text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(artwork?.description ?? ''),
                          }}
                        ></p>
                      </div>

                      {/* Cross-border shipment */}
                      {user && (
                        <div className="mt-4">
                          <button
                            onClick={() => setShipSimOpen((v) => !v)}
                            className="flex items-center gap-2 text-sm px-4 py-2 rounded-[4px] border border-kcb-or/30 text-kcb-or hover:bg-kcb-or/5 transition w-full justify-center"
                          >
                            <Truck className="w-4 h-4" />
                            Demander l'expédition transfrontalière
                          </button>

                          {shipSimOpen &&
                            (() => {
                              const options = simShipmentPrices(artwork)
                              return (
                                <div className="mt-3 border border-kcb-or/20 rounded-[4px] bg-kcb-ardoise overflow-hidden">
                                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                                    <span className="text-xs font-semibold text-kcb-or uppercase tracking-wider flex items-center gap-1.5">
                                      <Truck className="w-3.5 h-3.5" /> Simulation d'expédition
                                    </span>
                                    <button
                                      onClick={() => setShipSimOpen(false)}
                                      className="text-kcb-pierre hover:text-white transition"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="px-4 py-3 space-y-2">
                                    {options.map(({ key, icon: Icon, label, days, eur }) => (
                                      <div
                                        key={key}
                                        className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Icon className="w-4 h-4 text-kcb-pierre" />
                                          <div>
                                            <p className="text-white text-sm font-medium">
                                              {label}
                                            </p>
                                            <p className="text-kcb-pierre text-xs flex items-center gap-1">
                                              <Clock className="w-3 h-3" /> {days}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="font-semibold text-kcb-or text-sm">
                                          ~{eur} EUR
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="px-4 pb-4 pt-1">
                                    <p className="text-kcb-pierre text-[11px] mb-3 italic">
                                      Simulation indicative — devis confirmé sous 48h par l'équipe
                                      Kucibok.
                                    </p>
                                    <button
                                      onClick={() => {
                                        setShipSimOpen(false)
                                        setShipmentOpen(true)
                                      }}
                                      className="w-full flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-[4px] bg-kcb-or hover:bg-kcb-bronze text-kcb-noir font-semibold transition"
                                    >
                                      <Truck className="w-4 h-4" /> Confirmer la demande
                                    </button>
                                  </div>
                                </div>
                              )
                            })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </RevealOnScroll>

            {/* ── UPSELL — Du même artiste ── */}
            {sameArtist.length > 0 && (
              <RevealOnScroll>
                <section className="mt-16">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-playfair text-xl md:text-2xl font-bold text-white">
                      Autres œuvres de{' '}
                      {artwork?.artist?.name ||
                        artwork?.artists?.name ||
                        (typeof artwork?.artist === 'string' ? artwork.artist : 'cet artiste')}
                    </h2>
                    {(artwork?.artist?._id || artwork?.artists?.id) && (
                      <Link
                        to={`${portal}/artist/${artwork.artist?._id || artwork.artists?.id}`}
                        className="text-xs tracking-[0.06em] uppercase text-kcb-or hover:text-kcb-bronze transition no-underline font-medium"
                      >
                        Voir tout
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {sameArtist.map((item) => (
                      <ArtworkCard
                        key={item._id || item.id}
                        artwork={item}
                        artist={artwork?.artist}
                      />
                    ))}
                  </div>
                </section>
              </RevealOnScroll>
            )}

            {/* ── CROSS-SELL — Œuvres similaires ── */}
            {similar.length > 0 && (
              <RevealOnScroll>
                <section className="mt-16 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-playfair text-xl md:text-2xl font-bold text-white">
                      Œuvres similaires
                    </h2>
                    <Link
                      to={`${portal}/catalogue`}
                      className="text-xs tracking-[0.06em] uppercase text-kcb-or hover:text-kcb-bronze transition no-underline font-medium"
                    >
                      Voir la catégorie
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {similar.map((item) => (
                      <ArtworkCard key={item._id || item.id} artwork={item} />
                    ))}
                  </div>
                </section>
              </RevealOnScroll>
            )}

            {/* Shipment modal */}
            {user && (
              <RequestShipmentModal
                artwork={artwork}
                isOpen={shipmentOpen}
                onClose={() => setShipmentOpen(false)}
              />
            )}
          </>
        )}
        {artwork?.error && (
          <div className="text-center py-12 px-6 border border-dashed border-white/[0.06] rounded-[4px] bg-kcb-ardoise/30 mt-10">
            <Image className="w-16 h-16 mx-auto mb-4 text-kcb-pierre" />
            <h2 className="text-lg font-semibold mb-2 text-white">Œuvre indisponible</h2>
            <div className="my-6">
              <Link
                to={`${portal}/catalogue`}
                className="bg-kcb-or hover:bg-kcb-bronze rounded-[4px] py-2 px-4 text-kcb-noir font-semibold transition uppercase tracking-[0.05em] text-sm"
              >
                Aller sur le catalogue
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
