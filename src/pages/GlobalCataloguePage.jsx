import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Search, X, SlidersHorizontal, ArrowRight, Loader2 } from 'lucide-react'
import PortalLayout from '../components/landing/PortalLayout'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import SectionLabel from '../components/landing/SectionLabel'
import { getAllArtworks } from '../api/useArtworks'
import { getAllArtists } from '../api/useArtists'
import { useLang } from '../store/LangContext'
import { globalT } from '../i18n/global'

const PAGE_SIZE = 12

function validImageUrl(url) {
  if (!url) return null
  if (url.includes('backend.kucibok.com')) return null
  return url
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const SORT_FNS = {
  random: () => 0,
  recent: (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
  price_asc: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
  price_desc: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
}

function ArtworkCard({ artwork }) {
  return (
    <Link
      to={`/artwork/${artwork.id ?? artwork._id}`}
      className="group block relative overflow-hidden bg-kcb-noir border border-white/[0.05] hover:border-[var(--accent)]/40 transition-all duration-300 hover:-translate-y-0.5 no-underline"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-kcb-ardoise">
        {validImageUrl(artwork.image) ? (
          <img
            src={validImageUrl(artwork.image)}
            alt={artwork.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = '/images/placeholder-artwork.svg'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-kcb-pierre/30 text-5xl">
            ◻
          </div>
        )}
        {/* KCB badge */}
        {artwork.kucibok_id && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-[var(--accent)]/90 backdrop-blur-sm px-2 py-0.5">
            <ShieldCheck className="w-3 h-3 text-kcb-noir" />
            <span className="font-jetbrains text-[9px] font-bold text-kcb-noir tracking-[0.08em]">
              KCB
            </span>
          </div>
        )}
        {/* For sale badge */}
        {artwork.for_sale && !artwork.sold && (
          <div className="absolute top-3 left-3 bg-kcb-noir/80 backdrop-blur-sm border border-white/[0.08] px-2 py-0.5">
            <span className="font-dm-sans text-[9px] uppercase tracking-[0.08em] text-kcb-sable">
              Available
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="font-playfair text-white text-sm font-semibold leading-snug truncate mb-0.5">
          {artwork.title}
        </p>
        <p className="text-kcb-pierre text-xs truncate mb-2">
          {artwork.artist ?? 'Unknown artist'}
        </p>
        <div className="flex items-center justify-between gap-2">
          {artwork.for_sale && artwork.price ? (
            <span className="text-[var(--accent)] text-xs font-semibold font-dm-sans">
              {Number(artwork.price).toLocaleString('fr-FR')} {artwork.currency || 'XOF'}
            </span>
          ) : (
            <span className="text-kcb-pierre/50 text-xs">Not for sale</span>
          )}
          {artwork.kucibok_id && (
            <span className="font-jetbrains text-[9px] text-[var(--accent)]/60 truncate max-w-[80px]">
              {artwork.kucibok_id}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function CatalogueContent() {
  const { lang } = useLang()
  const t = globalT[lang]

  const [allArtworks, setAllArtworks] = useState([])
  const [allArtists, setAllArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [forSaleOnly, setForSaleOnly] = useState(false)
  const [certifiedOnly, setCertified] = useState(false)
  const [sort, setSort] = useState('random')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [activeTab, setActiveTab] = useState('artworks')

  useEffect(() => {
    window.scrollTo(0, 0)
    Promise.all([
      getAllArtworks({ status: 'approved', limit: 1000 }),
      getAllArtists({ limit: 500 }),
    ]).then(([artRes, artisRes]) => {
      const artList = Array.isArray(artRes)
        ? artRes
        : (artRes?.artworks ?? artRes?.data ?? [])
      const artistList = Array.isArray(artisRes)
        ? artisRes
        : (artisRes?.artists ?? artisRes?.data ?? [])
      setAllArtworks(shuffle(artList))
      setAllArtists(artistList)
      setLoading(false)
    })
  }, [])

  const categories = ['All', ...new Set(allArtworks.map((a) => a.category).filter(Boolean))]

  const filtered = allArtworks
    .filter((a) => {
      if (search) {
        const q = search.toLowerCase()
        if (!a.title?.toLowerCase().includes(q) && !a.artist?.toLowerCase().includes(q))
          return false
      }
      if (category !== 'All' && a.category !== category) return false
      if (forSaleOnly && !a.for_sale) return false
      if (certifiedOnly && !a.kucibok_id) return false
      return true
    })
    .sort(SORT_FNS[sort])

  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  const clearFilters = useCallback(() => {
    setSearch('')
    setCategory('All')
    setForSaleOnly(false)
    setCertified(false)
    setSort('random')
    setVisible(PAGE_SIZE)
  }, [])

  const hasActive =
    search || category !== 'All' || forSaleOnly || certifiedOnly || sort !== 'random'

  return (
    <div className="min-h-screen bg-kcb-noir-deep text-white pt-28">
      {/* Header */}
      <div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] pb-14 border-b border-white/[0.04]">
        <RevealOnScroll>
          <SectionLabel text={t.catalogue.label} />
          <h1 className="font-playfair font-bold text-[clamp(32px,4vw,52px)] text-white mt-4 mb-3 leading-tight">
            {t.catalogue.title}
          </h1>
          <p className="text-kcb-pierre text-[15px] max-w-xl">
            {lang === 'en'
              ? 'Every artwork verified. Every artist documented. Every piece traceable.'
              : 'Chaque œuvre vérifiée. Chaque artiste documenté. Chaque pièce traçable.'}
          </p>
        </RevealOnScroll>

        {/* Stats */}
        {!loading && (
          <RevealOnScroll delay={0.1}>
            <div className="flex flex-wrap gap-8 mt-8 text-sm">
              <div>
                <span className="text-[var(--accent)] font-bold text-2xl font-playfair">
                  {allArtworks.length}
                </span>
                <span className="text-kcb-pierre ml-2 text-xs uppercase tracking-widest">
                  {lang === 'en' ? 'works' : 'œuvres'}
                </span>
              </div>
              <div>
                <span className="text-[var(--accent)] font-bold text-2xl font-playfair">
                  {allArtworks.filter((a) => a.kucibok_id).length}
                </span>
                <span className="text-kcb-pierre ml-2 text-xs uppercase tracking-widest">
                  {lang === 'en' ? 'certified KCB' : 'certifiées KCB'}
                </span>
              </div>
              <div>
                <span className="text-[var(--accent)] font-bold text-2xl font-playfair">
                  {allArtists.length}
                </span>
                <span className="text-kcb-pierre ml-2 text-xs uppercase tracking-widest">
                  {lang === 'en' ? 'artists' : 'artistes'}
                </span>
              </div>
            </div>
          </RevealOnScroll>
        )}

        {/* Tabs */}
        {!loading && (
          <div className="flex gap-0 mt-10 border-b border-white/[0.06]">
            {['artworks', 'artists'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-xs font-medium uppercase tracking-[0.08em] transition-all border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-[var(--accent)] text-white'
                    : 'border-transparent text-kcb-pierre hover:text-white'
                }`}
              >
                {tab === 'artworks'
                  ? lang === 'en'
                    ? `Artworks (${allArtworks.length})`
                    : `Œuvres (${allArtworks.length})`
                  : lang === 'en'
                    ? `Artists (${allArtists.length})`
                    : `Artistes (${allArtists.length})`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] py-10">
        {/* Filter bar — visible uniquement sur onglet artworks */}
        <div
          className={`bg-kcb-ardoise border border-white/[0.05] p-4 mb-10 flex flex-wrap gap-3 items-center ${activeTab === 'artists' ? 'hidden' : ''}`}
        >
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kcb-pierre" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setVisible(PAGE_SIZE)
              }}
              placeholder={lang === 'en' ? 'Search by title or artist…' : 'Titre ou artiste…'}
              className="w-full bg-kcb-noir border border-white/[0.06] pl-9 pr-4 py-2 text-sm text-white placeholder-kcb-pierre/50 focus:outline-none focus:border-[var(--accent)] transition"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('')
                  setVisible(PAGE_SIZE)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-kcb-pierre hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setVisible(PAGE_SIZE)
              }}
              className="appearance-none bg-kcb-noir border border-white/[0.06] pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)] cursor-pointer transition"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kcb-pierre pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value)
                setVisible(PAGE_SIZE)
              }}
              className="appearance-none bg-kcb-noir border border-white/[0.06] pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)] cursor-pointer transition"
            >
              <option value="random">{lang === 'en' ? 'Random' : 'Aléatoire'}</option>
              <option value="recent">{lang === 'en' ? 'Most recent' : 'Plus récent'}</option>
              <option value="price_asc">{lang === 'en' ? 'Price ↑' : 'Prix ↑'}</option>
              <option value="price_desc">{lang === 'en' ? 'Price ↓' : 'Prix ↓'}</option>
            </select>
            <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kcb-pierre pointer-events-none" />
          </div>

          {/* Toggles */}
          <button
            onClick={() => {
              setForSaleOnly(!forSaleOnly)
              setVisible(PAGE_SIZE)
            }}
            className={`text-xs font-medium px-4 py-2 border transition-all ${forSaleOnly ? 'bg-[var(--accent)] border-[var(--accent)] text-kcb-noir' : 'bg-transparent border-white/[0.08] text-kcb-pierre hover:text-white hover:border-white/20'}`}
          >
            {lang === 'en' ? 'For sale' : 'En vente'}
          </button>
          <button
            onClick={() => {
              setCertified(!certifiedOnly)
              setVisible(PAGE_SIZE)
            }}
            className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 border transition-all ${certifiedOnly ? 'bg-[var(--accent)] border-[var(--accent)] text-kcb-noir' : 'bg-transparent border-white/[0.08] text-kcb-pierre hover:text-white hover:border-white/20'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> KCB
          </button>

          {hasActive && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-kcb-pierre hover:text-white border border-white/[0.06] px-3 py-2 transition"
            >
              <X className="w-3.5 h-3.5" /> {lang === 'en' ? 'Reset' : 'Réinitialiser'}
            </button>
          )}

          <span className="ml-auto text-xs text-kcb-pierre/60 self-center">
            {loading ? '' : `${filtered.length} ${lang === 'en' ? 'result(s)' : 'résultat(s)'}`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
            <p className="text-kcb-pierre text-sm">
              {lang === 'en' ? 'Loading collection…' : 'Chargement de la collection…'}
            </p>
          </div>
        ) : activeTab === 'artists' ? (
          /* ── ARTISTS GRID ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0.5">
            {allArtists.map((artist) => (
              <Link
                key={artist.id}
                to={`/artist/${artist.id}`}
                className="group block bg-kcb-noir border border-white/[0.05] hover:border-[var(--accent)]/40 transition-all duration-300 hover:-translate-y-0.5 no-underline p-5"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden bg-kcb-ardoise mb-4 border border-white/[0.06]">
                  {artist.image ? (
                    <img
                      src={artist.image}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-playfair text-xl text-kcb-pierre/50">
                      {artist.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <p className="font-playfair font-semibold text-white text-sm leading-snug truncate mb-0.5">
                  {artist.name}
                </p>
                <p className="text-kcb-pierre text-xs truncate">
                  {artist.country ?? artist.location ?? ''}
                </p>
              </Link>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <p className="text-kcb-sable text-lg font-playfair">
              {lang === 'en' ? 'No artworks found' : 'Aucune œuvre trouvée'}
            </p>
            <button
              onClick={clearFilters}
              className="text-xs text-[var(--accent)] border border-[var(--accent)]/30 px-4 py-2 hover:bg-[var(--accent)]/5 transition"
            >
              {lang === 'en' ? 'Reset filters' : 'Réinitialiser les filtres'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0.5">
              {shown.map((artwork) => (
                <ArtworkCard key={artwork.id ?? artwork._id} artwork={artwork} />
              ))}
            </div>

            {hasMore && (
              <div className="text-center mt-14">
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.08] text-white text-xs uppercase tracking-[0.08em] font-medium hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition"
                >
                  {lang === 'en' ? 'Load more' : 'Voir plus'} <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-kcb-pierre/50 text-xs mt-3">
                  {shown.length} / {filtered.length}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sourcing CTA strip */}
      <div className="border-t border-white/[0.04] mt-10">
        <div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] py-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-white font-playfair font-semibold text-lg mb-1">
              {lang === 'en'
                ? 'Looking for something specific?'
                : 'Vous cherchez quelque chose de précis ?'}
            </p>
            <p className="text-kcb-pierre text-sm">
              {lang === 'en'
                ? 'Our B2B sourcing team connects you with the right artists for your programme.'
                : 'Notre équipe sourcing B2B vous connecte aux bons artistes pour votre programme.'}
            </p>
          </div>
          <Link
            to="/global/sourcing"
            className="shrink-0 inline-flex items-center gap-2 bg-[var(--accent)] text-kcb-noir-deep font-dm-sans font-semibold text-xs tracking-[0.08em] uppercase px-8 py-3.5 hover:bg-[var(--accent-dark)] transition no-underline"
          >
            {lang === 'en' ? 'Request Sourcing' : 'Demander un Sourcing'}{' '}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function GlobalCataloguePage() {
  return (
    <PortalLayout portal="global">
      <CatalogueContent />
    </PortalLayout>
  )
}
