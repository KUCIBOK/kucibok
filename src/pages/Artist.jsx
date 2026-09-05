import { memo, useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link, useParams } from 'react-router-dom'
import { getArtistForSaleArtworks } from '../api/useArtworks'
import { ArrowLeft, Camera } from 'lucide-react'
import { Skeleton, SkeletonCard } from '../components/ui'
import { Marketplace } from '../components/artworks/Marketplace'
import { getArtistAndUpdateVisited, getArtistById } from '../api/useArtists'
import { useArtistProfile } from '../api/useArtistProfileQuery' /* ✨ React Query */
import { useAuthUser } from '../api/useAuthUser' /* ✨ React Query */
import { Helmet } from 'react-helmet'
import RevealOnScroll from '../components/landing/RevealOnScroll'

export default function ArtistDetails() {
  const { id } = useParams()
  const tabs = ['Oeuvres', 'Biographie', 'Expositions']
  const { data: artistProfile } = useArtistProfile() /* ✨ React Query */

  const [state, setState] = useState({
    artist: null,
    artworks: [],
    tab: 0,
    loading: true,
  })
  useEffect(() => {
    window.scrollTo(0, 0)
    const fetchArtworks = async () => {
      let artist = null
      if (artistProfile?.id != id) {
        artist = await getArtistAndUpdateVisited(id)
      }
      artist = await getArtistById(id)
      const set = await getArtistForSaleArtworks(id)
      if (set?.length >= 1 || artist?.id) {
        setState({
          ...state,
          loading: false,
          artist: artist,
          artworks: set,
        })
      }
    }
    fetchArtworks()
  }, [])

  const handleTabChange = (index) => {
    setState((prev) => ({
      ...prev,
      tab: index,
    }))
  }
  const renderTabContent = () => {
    switch (state?.tab) {
      case 0:
        return (
          <>
            <Marketplace artworks={state?.artworks} />
          </>
        )
      case 1:
        return (
          <div className="border border-white/[0.06] bg-kcb-ardoise/30 rounded-[4px] p-4 text-kcb-sable">
            <span
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(state?.artist?.biography ?? ''),
              }}
            ></span>
          </div>
        )
      case 2: {
        const exhibitions = state?.artist?.exhibitions ?? state?.artist?.expositions ?? []
        const items = Array.isArray(exhibitions) ? exhibitions : []
        return (
          <div className="space-y-4 text-kcb-sable">
            <div>
              <h2 className="text-lg font-semibold text-white">Expositions et parcours</h2>
              <p className="text-sm text-kcb-pierre mt-1">
                Expositions, foires, biennales et collaborations de l’artiste.
              </p>
            </div>
            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const exhibition = typeof item === 'string' ? { title: item } : item
                  return (
                    <div key={exhibition.id ?? index} className="border-l-2 border-kcb-or/60 pl-4">
                      <p className="text-white font-medium">{exhibition.title || exhibition.name}</p>
                      {(exhibition.venue || exhibition.location || exhibition.year) && (
                        <p className="text-sm text-kcb-pierre">
                          {[exhibition.venue, exhibition.location, exhibition.year]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {exhibition.description && (
                        <p className="text-sm text-kcb-pierre mt-1">{exhibition.description}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-kcb-pierre">Aucune exposition renseignée pour le moment.</p>
            )}
          </div>
        )
      }

      default:
        return (
          <>
            <Marketplace artworks={state?.artworks} />
          </>
        )
    }
  }
  if (state.loading) {
    return (
      <div className="md:max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Cover skeleton */}
        <Skeleton width="w-full" height="h-[25vh]" className="rounded-none" />
        {/* Profile + content layout */}
        <div className="flex flex-col lg:flex-row gap-6 -mt-14">
          {/* Avatar card skeleton */}
          <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-8 flex flex-col items-center gap-3 w-full lg:w-64 shrink-0">
            <Skeleton variant="circle" width="w-32" height="h-32" />
            <Skeleton width="w-40" height="h-5" />
            <Skeleton width="w-24" height="h-4" />
          </div>
          {/* Artworks grid skeleton */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} hasImage />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>{state?.artist?.name ? `${state?.artist?.name} | Kucibok` : 'Kucibok'}</title>
        <meta name="description" content={state?.artist?.biography || ''} />
        <meta property="og:title" content={state?.artist?.name || 'Kucibok'} />
        <meta property="og:description" content={state?.artist?.biography || ''} />
        <meta property="og:image" content={state?.artist?.image || ''} />
        <meta
          property="og:url"
          content={`https://kucibok.com/artist/${state?.artist?._id || ''}`}
        />
      </Helmet>
      <div className="flex mx-auto flex-start lg:px-8 px-6 my-4">
        <Link
          to={-1}
          className="flex items-center gap-2 text-sm text-kcb-sable hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
      </div>
      {/* Modern minimal cover/fallback */}
      <div className="w-full md:px-8 px-2 mx-auto mb-0 md:max-w-7xl">
        {state?.artworks?.length > 0 ? (
          <div className="grid grid-cols-3 h-[25vh] md:h-[30vh]">
            {state?.artworks?.slice(0, 3)?.map((artwork) => (
              <div key={artwork.id} className="overflow-hidden">
                <img
                  src={artwork.image}
                  alt={artwork.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = '/images/placeholder-artwork.svg'
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full rounded-[4px] h-60 bg-kcb-or/10 mb-4" />
        )}
      </div>

      {/* Modern minimal artist card and tabs */}
      <div className="flex flex-col md:px-8 px-2 lg:flex-row gap-6 md:gap-8 w-full mx-auto -mt-14 md:-mt-20 z-10 relative mb-12 md:mb-20 md:max-w-7xl">
        <RevealOnScroll>
          <div className="flex flex-col items-center max-h-fit bg-kcb-ardoise border border-white/[0.06] rounded-[4px] shadow-xl px-5 md:px-8 py-7 md:py-10 w-full lg:w-3/9">
            <div className="relative mb-3">
              {state.artist?.image ? (
                <img
                  src={state.artist.image}
                  alt={state.artist.name}
                  className="rounded-full w-32 h-32 object-cover border-4 border-kcb-noir-deep shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-kcb-or/20 flex justify-center items-center">
                  <Camera className="w-10 h-10 text-kcb-or" />
                </div>
              )}
              <span className="absolute bottom-2 right-2 bg-kcb-ardoise/80 text-xs text-kcb-sable px-2 py-0.5 rounded-full shadow">
                {state.artist?.country}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1 truncate text-center w-full">
              {state.artist?.name}
            </h1>
            <div className="inline-block bg-kcb-ardoise/80 px-3 py-1 rounded-full text-xs text-kcb-sable mb-2 border border-white/[0.06]">
              {state.artworks?.length || 0} {state.artworks?.length === 1 ? 'œuvre' : 'œuvres'}
            </div>
            {state.artist?.socials && (
              <div className="flex gap-3 mt-2">
                {state.artist.socials.facebook && (
                  <a
                    href={state.artist.socials.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-kcb-ardoise hover:bg-kcb-or rounded-full flex items-center justify-center transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                )}
                {state.artist.socials.instagram && (
                  <a
                    href={state.artist.socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-kcb-ardoise hover:bg-kcb-or rounded-full flex items-center justify-center transition-all duration-200"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </a>
                )}
                {state.artist.socials.twitter && (
                  <a
                    href={state.artist.socials.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-kcb-ardoise hover:bg-kcb-or rounded-full flex items-center justify-center transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1}>
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex gap-2 bg-kcb-ardoise rounded-[4px] px-2 py-1.5 w-fit shadow-sm border border-white/[0.06]">
              {tabs.map((tab, idx) => (
                <button
                  key={idx}
                  className={`rounded-[4px] px-4 py-1 text-sm font-medium transition-all duration-200 ${state.tab === idx ? 'bg-kcb-noir-deep text-white shadow' : 'text-kcb-pierre hover:text-white hover:bg-kcb-noir-deep/60'}`}
                  onClick={() => handleTabChange(idx)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="rounded-[4px] border border-white/[0.06] bg-kcb-noir-deep/80 p-4 min-h-[120px]">
              {renderTabContent()}
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </>
  )
}
