/**
 * MyShortlist.jsx — Dashboard page showing all shortlisted artworks
 * Réutilisable pour Curator et Advisor
 */

import { useEffect, useState } from 'react'
import { Heart, Loader2, Trash2, ShieldCheck } from 'lucide-react'
import { getMyShortlistSession, removeFromShortlistSession } from '../../api/useShortlist'

const AVAILABILITY_LABELS = {
  available: { label: 'Disponible', color: 'text-green-400 bg-green-900/30 border-green-800/40' },
  on_exhibition: { label: 'En exposition', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/40' },
  on_request: { label: 'Sur demande', color: 'text-kcb-or bg-kcb-or/10 border-kcb-or/30' },
  unavailable: { label: 'Indisponible', color: 'text-red-400 bg-red-900/30 border-red-800/40' },
}

function validImageUrl(url) {
  if (!url) return null
  if (url.includes('backend.kucibok.com')) return null
  return url
}

export function MyShortlist() {
  const [shortlist, setShortlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    const fetchShortlist = async () => {
      setLoading(true)
      const result = await getMyShortlistSession()
      if (result.success) {
        setShortlist(result.data || [])
      } else {
        setError(result.error)
      }
      setLoading(false)
    }

    fetchShortlist()
  }, [])

  const handleRemove = async (artworkId) => {
    setRemovingId(artworkId)
    const result = await removeFromShortlistSession(artworkId)
    if (result.success) {
      setShortlist((prev) => prev.filter((item) => item.artwork_id !== artworkId))
    }
    setRemovingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-kcb-or animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-400">
        <p className="text-lg font-medium mb-2">Error loading shortlist</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (shortlist.length === 0) {
    return (
      <div className="text-center py-20 text-kcb-pierre">
        <Heart className="w-12 h-12 text-kcb-or/30 mx-auto mb-4" />
        <p className="text-lg font-medium text-white mb-2">No Shortlisted Artworks</p>
        <p className="text-sm max-w-md mx-auto">
          Browse the catalogue and click the heart icon to add artworks to your shortlist.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className="font-playfair text-xl text-white">My Shortlist</h2>
        <p className="text-sm text-kcb-pierre mt-0.5">
          {shortlist.length} artwork{shortlist.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {/* Grid of shortlisted artworks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {shortlist.map((item) => {
          const artwork = item.artworks
          if (!artwork) return null

          const avail = artwork.availabilityStatus
            ? AVAILABILITY_LABELS[artwork.availabilityStatus]
            : null

          return (
            <div
              key={item.id}
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
                    No image
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

                {/* Availability badge */}
                {avail && (
                  <span
                    className={`absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full border font-medium ${avail.color}`}
                  >
                    {avail.label}
                  </span>
                )}

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(artwork.id)}
                  disabled={removingId === artwork.id}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Info */}
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

                {/* Notes */}
                {item.notes && (
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-kcb-pierre italic">{item.notes}</p>
                  </div>
                )}

                {/* Date added */}
                <div className="mt-auto pt-3 text-xs text-kcb-pierre/60">
                  Added {new Date(item.created_at).toLocaleDateString('en-US')}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Named export (used in dashboards)
// export default MyShortlist
