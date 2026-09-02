import { Helmet } from 'react-helmet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useArtists } from '../api/useArtistsQuery' /* ✨ React Query */

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
import { Search } from 'lucide-react'
import { DataLoader } from '../components/loaders/PageLoader'
import { ArtistList } from '../components/artists/ArtistsList'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import SectionLabel from '../components/landing/SectionLabel'

export default function Artists() {
  const { data: artists = [], isLoading: contextLoading } = useArtists() /* ✨ React Query */
  // Deduplicate by _id then shuffle randomly (different order each refresh)
  const sortedArtists = useMemo(() => {
    const seen = new Set()
    const unique = (artists ?? []).filter((item) => {
      const key = item._id ?? item.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return shuffleArray(unique)
     
  }, [artists])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filtered, setFiltered] = useState([])
  const debounceRef = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Debounce : attend 300ms après la dernière frappe avant de filtrer
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  useEffect(() => {
    let result = sortedArtists
    if (debouncedSearch.trim() !== '') {
      const s = debouncedSearch.toLowerCase()
      result = sortedArtists.filter(
        (item) =>
          (item.name ?? '').toLowerCase().includes(s) ||
          item.country?.toLowerCase().includes(s)
      )
    }
    setFiltered(result)
  }, [artists, debouncedSearch])

  return (
    <>
      <Helmet>
        <title>Artistes africains — Kucibok | Découvrez les créateurs certifiés</title>
        <meta
          name="description"
          content="Découvrez les artistes africains contemporains certifiés sur Kucibok Bridge. Peintures, sculptures, photographies — explorez leurs œuvres et leur univers."
        />
        <meta property="og:title" content="Artistes africains contemporains — Kucibok" />
        <meta
          property="og:description"
          content="192 artistes africains contemporains certifiés. Explorez leurs œuvres et collections sur Kucibok Bridge."
        />
        <meta property="og:url" content="https://kucibok.com/artists" />
        <link rel="canonical" href="https://kucibok.com/artists" />
      </Helmet>
      <div className="mx-auto px-4 md:px-6 flex-grow pb-16 mt-8">
        <div className="text-center mb-8 md:mb-14">
          <RevealOnScroll>
            <SectionLabel text="Artistes" />
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <h1 className="font-playfair font-bold text-[clamp(28px,3.5vw,48px)] text-white mt-4 mb-3">
              Découvrez les artistes africains
            </h1>
          </RevealOnScroll>
          <RevealOnScroll delay={0.2}>
            <p className="text-kcb-pierre text-[15px]">
              Explorez les divers talents des artistes digitaux autour du continent
            </p>
          </RevealOnScroll>
        </div>
        <RevealOnScroll delay={0.25}>
          <div className="flex justify-center items-center mb-10 mx-auto w-full max-w-xl">
            <div className="relative w-full">
              <label htmlFor="artist-search" className="sr-only">
                Rechercher un artiste par nom ou par pays
              </label>
              <input
                id="artist-search"
                value={search}
                onChange={handleSearchChange}
                type="text"
                className="w-full bg-kcb-noir border border-white/[0.08] focus:border-kcb-or transition-colors duration-200 outline-none text-white placeholder-kcb-pierre rounded-[4px] py-3 pl-12 pr-4 shadow-sm focus:shadow-md focus:ring-2 focus:ring-kcb-or"
                placeholder="Cherchez les artistes par nom ou par pays"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-kcb-pierre pointer-events-none">
                <Search className="w-5 h-5" />
              </span>
            </div>
          </div>
        </RevealOnScroll>
        <div className="flex flex-col gap-6">
          {contextLoading ? (
            <div className="flex items-center justify-center h-40">
              <DataLoader />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-white/[0.06] border-dashed rounded-[4px] w-full bg-kcb-ardoise/30">
              <h3 className="font-medium text-base text-kcb-pierre mb-1">
                {debouncedSearch.trim()
                  ? `Aucun artiste trouvé pour "${debouncedSearch}".`
                  : 'Aucun artiste pour le moment.'}
              </h3>
              {debouncedSearch.trim() ? (
                <button
                  onClick={() => {
                    setSearch('')
                    setDebouncedSearch('')
                  }}
                  className="mt-3 text-xs text-kcb-or underline hover:text-kcb-bronze transition"
                >
                  Effacer la recherche
                </button>
              ) : (
                <p className="text-xs text-kcb-pierre/60">
                  Revenez bientôt pour découvrir nos artistes certifiés.
                </p>
              )}
            </div>
          ) : (
            <ArtistList artists={filtered} />
          )}
        </div>
      </div>
    </>
  )
}
