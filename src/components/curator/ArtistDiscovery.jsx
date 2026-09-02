import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  CheckCircle,
  Star,
  Globe,
  Award,
  Image,
  X,
  Download,
  ExternalLink,
  ChevronDown,
  Loader,
  AlertCircle,
  Mail,
} from 'lucide-react'
import { useArtist } from '../../api/useArtistContextQuery'

// Badge de vérification : utilise kucibok_id comme indicateur principal de certification
function VerifiedBadge({ artist }) {
  const certified = !!artist?.kucibok_id
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${certified ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20' : 'bg-white/[0.04] text-kcb-pierre border-white/[0.06]'}`}>
      {certified ? '✓ Certifié KCB' : '○ Non certifié'}
    </span>
  )
}

function ArtistCard({ artist, onSelect, shortlistedIds, onShortlist }) {
  const isShortlisted = shortlistedIds.has(artist._id ?? artist.id)
  const artistId = artist._id ?? artist.id
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-[#9B4D96]/30 transition-all group"
    >
      <div className="h-28 relative flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a1f3a, #12121a)' }}>
        {artist.image
          ? <img src={artist.image} alt={artist.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />
          : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#9B4D96]/50 to-kcb-or/20 flex items-center justify-center text-2xl font-bold text-white font-playfair">
              {(artist.name ?? '?').charAt(0)}
            </div>
          )
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,5,5,0.8) 0%, transparent 60%)' }} />
        <button
          onClick={(e) => { e.stopPropagation(); onShortlist(artistId) }}
          className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition ${isShortlisted ? 'bg-kcb-or text-kcb-noir' : 'bg-kcb-noir/60 text-kcb-pierre hover:text-kcb-or'}`}
        >
          <Star className="w-3.5 h-3.5" />
        </button>
        <div className="absolute bottom-2 left-3 text-xs text-kcb-sable">{artist.country ?? ''}</div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{artist.name ?? '—'}</h3>
            <p className="text-xs text-kcb-pierre truncate">{artist.type ?? artist.style ?? 'Artiste'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <VerifiedBadge artist={artist} />
          {artist.kucibok_id && (
            <span className="font-jetbrains text-[10px] text-kcb-pierre">{artist.kucibok_id}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-kcb-pierre">
          {artist.artworks_count != null && (
            <span className="flex items-center gap-1"><Image className="w-3 h-3" /> {artist.artworks_count} œuvres</span>
          )}
          {artist.exhibitions_count != null && (
            <span className="flex items-center gap-1"><Award className="w-3 h-3" /> {artist.exhibitions_count} expos</span>
          )}
          {artist.languages?.length > 0 && (
            <span className="flex items-center gap-1 col-span-2"><Globe className="w-3 h-3" /> {artist.languages.slice(0, 2).join(', ')}</span>
          )}
          {artist.price_range && (
            <span className="col-span-2 text-kcb-or font-medium">{artist.price_range}</span>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Link
            to={`/artists/${artistId}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-[#9B4D96]/15 text-[#c084d8] hover:bg-[#9B4D96]/25 rounded-[4px] border border-[#9B4D96]/20 transition"
          >
            <ExternalLink className="w-3 h-3" /> Voir profil
          </Link>
          <Link
            to="/contact"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-kcb-or/10 text-kcb-or hover:bg-kcb-or/20 rounded-[4px] border border-kcb-or/20 transition"
          >
            <Mail className="w-3 h-3" /> Contacter
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

function ArtistModal({ artist, onClose }) {
  if (!artist) return null
  const certified = !!artist?.kucibok_id
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-kcb-ardoise border border-white/[0.08] rounded-[4px] shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {artist.image
                ? <img src={artist.image} alt={artist.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-white/10" />
                : <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#9B4D96]/50 to-kcb-or/20 flex items-center justify-center text-2xl font-bold text-white font-playfair flex-shrink-0">{(artist.name ?? '?').charAt(0)}</div>
              }
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-playfair text-xl text-white">{artist.name ?? '—'}</h2>
                  {certified && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-kcb-pierre text-sm">{artist.country ?? '—'}</p>
                <p className="text-xs text-[#9B4D96]">{artist.type ?? artist.style ?? 'Artiste'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-kcb-pierre hover:text-white transition p-1"><X className="w-5 h-5" /></button>
          </div>

          {artist.kucibok_id && (
            <div className="flex items-center gap-3 mb-6 p-4 bg-kcb-noir/40 rounded-[4px]">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">Certifié Kucibok</p>
                <p className="font-jetbrains text-xs text-kcb-pierre">{artist.kucibok_id}</p>
              </div>
            </div>
          )}

          {artist.bio && (
            <div className="mb-5">
              <p className="text-xs text-kcb-pierre uppercase tracking-wider mb-2">Biographie</p>
              <p className="text-sm text-kcb-sable leading-relaxed">{artist.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {[
              artist.artworks_count != null && { label: 'Œuvres', value: artist.artworks_count },
              artist.exhibitions_count != null && { label: 'Expositions', value: artist.exhibitions_count },
              artist.price_range && { label: 'Prix', value: artist.price_range },
            ].filter(Boolean).map((s, i) => (
              <div key={i} className="bg-kcb-noir/40 rounded-[4px] p-3 text-center">
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-xs text-kcb-pierre">{s.label}</p>
              </div>
            ))}
          </div>

          {artist.languages?.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-kcb-pierre uppercase tracking-wider mb-2">Langues</p>
              <div className="flex flex-wrap gap-1.5">
                {artist.languages.map((l) => <span key={l} className="text-xs bg-white/[0.06] text-kcb-sable px-2 py-0.5 rounded-full">{l}</span>)}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Link
              to="/contact"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 font-medium text-sm rounded-[4px] transition text-white"
              style={{ background: '#9B4D96' }}
            >
              <Mail className="w-4 h-4" /> Contacter Kucibok
            </Link>
            {artist.portfolio_url && (
              <a href={artist.portfolio_url} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-kcb-or/10 text-kcb-or font-medium text-sm rounded-[4px] border border-kcb-or/20 hover:bg-kcb-or/20 transition">
                <Download className="w-4 h-4" /> Portfolio
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function ArtistDiscovery() {
  const { artists, loading } = useArtist()
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('Tous')
  const [certifiedOnly, setCertifiedOnly] = useState(false)
  const [selected, setSelected] = useState(null)
  const [shortlistedIds, setShortlistedIds] = useState(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const countries = ['Tous', ...new Set((artists ?? []).map((a) => a.country).filter(Boolean))]

  const filtered = (artists ?? []).filter((a) => {
    const q = search.toLowerCase()
    const matchSearch = !search || (a.name ?? '').toLowerCase().includes(q) || (a.country ?? '').toLowerCase().includes(q)
    const matchCountry = countryFilter === 'Tous' || a.country === countryFilter
    const matchCertified = !certifiedOnly || !!a.kucibok_id
    return matchSearch && matchCountry && matchCertified
  })

  const toggleShortlist = (id) => {
    setShortlistedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 text-kcb-or animate-spin" />
      </div>
    )
  }

  if (!artists?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 border border-dashed border-white/[0.06] rounded-[4px]">
        <AlertCircle className="w-8 h-8 text-kcb-pierre" />
        <p className="text-kcb-pierre text-sm">Aucun artiste disponible pour le moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-playfair text-xl text-white">Découverte d'artistes</h2>
          <p className="text-sm text-kcb-pierre mt-0.5">Artistes de la plateforme Kucibok</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-kcb-pierre">{filtered.length} artiste{filtered.length !== 1 ? 's' : ''}</span>
          {shortlistedIds.size > 0 && <><span className="text-kcb-pierre">·</span><span className="text-kcb-or">{shortlistedIds.size} shortlistés</span></>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kcb-pierre" />
            <input
              type="text"
              placeholder="Rechercher un artiste, un pays..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-kcb-ardoise border border-white/[0.08] rounded-[4px] text-white text-sm placeholder-kcb-pierre focus:outline-none focus:border-[#9B4D96]/50 transition"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[4px] border text-sm transition ${showFilters ? 'bg-[#9B4D96]/15 border-[#9B4D96]/30 text-[#c084d8]' : 'bg-kcb-ardoise border-white/[0.08] text-kcb-pierre hover:text-white'}`}
          >
            <Filter className="w-4 h-4" /> Filtres
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-4 p-4 bg-kcb-ardoise border border-white/[0.06] rounded-[4px]">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-kcb-pierre">Pays</label>
                  <div className="relative">
                    <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="appearance-none bg-kcb-noir border border-white/[0.08] text-white text-sm px-3 py-2 pr-7 rounded-[4px] focus:outline-none focus:border-[#9B4D96]/50">
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-kcb-pierre pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1 justify-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setCertifiedOnly(!certifiedOnly)} className={`w-10 h-5 rounded-full relative transition-colors ${certifiedOnly ? 'bg-emerald-500' : 'bg-white/[0.1]'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${certifiedOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-kcb-pierre">Certifiés KCB uniquement</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((artist) => (
            <ArtistCard
              key={artist._id ?? artist.id}
              artist={artist}
              onSelect={setSelected}
              shortlistedIds={shortlistedIds}
              onShortlist={toggleShortlist}
            />
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 border border-dashed border-white/[0.06] rounded-[4px] text-center">
            <Search className="w-8 h-8 text-kcb-pierre mb-3" />
            <p className="text-kcb-pierre">Aucun artiste trouvé.</p>
            <button onClick={() => { setSearch(''); setCountryFilter('Tous'); setCertifiedOnly(false) }} className="mt-3 text-xs text-kcb-or underline hover:text-kcb-bronze">
              Réinitialiser
            </button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selected && <ArtistModal artist={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  )
}
