import { useMemo, useState } from 'react'
import { useArtists } from '../../api/useArtistsQuery' /* ✨ React Query */
import { useApprovedArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */
import { ExternalLink, Image, Search, Shield, ChevronLeft, ChevronRight } from 'lucide-react'

const PER_PAGE = 25

/**
 * Onglet admin — liste de tous les artistes avec statistiques.
 */
export function AdminArtistsTab() {
  const { data: artists = [] } = useArtists() /* ✨ React Query */
  const { data: approved = [] } = useApprovedArtworks() /* ✨ React Query */
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return artists ?? []
    const q = search.toLowerCase()
    return (artists ?? []).filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.country?.toLowerCase().includes(q) ||
        a.medium?.toLowerCase().includes(q)
    )
  }, [artists, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const getStats = (artistId, artistUserId) => {
    const works = (approved ?? []).filter(
      (w) =>
        (artistId && w.artist_id === artistId) ||
        (artistUserId && w.user_id === artistUserId)
    )
    const certified = works.filter((w) => w.kucibok_id)
    return { total: works.length, certified: certified.length }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white text-xl font-semibold">
          Artistes{' '}
          <span className="text-kcb-pierre text-base font-normal">({filtered.length})</span>
        </h3>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Nom, pays, médium…"
            className="bg-kcb-ardoise border border-white/[0.06] text-white text-sm rounded-[4px] pl-9 pr-3 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-kcb-or placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[4px] border border-white/[0.06]">
        <table className="w-full text-sm text-left">
          <thead className="bg-kcb-ardoise">
            <tr className="text-kcb-pierre text-xs uppercase tracking-wider">
              <th className="px-4 py-3">Artiste</th>
              <th className="px-4 py-3">Pays</th>
              <th className="px-4 py-3">Médium</th>
              <th className="px-4 py-3 text-center">Œuvres approuvées</th>
              <th className="px-4 py-3 text-center">Certifiées (KCB)</th>
              <th className="px-4 py-3 text-center">Profil public</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((artist) => {
              const stats = getStats(artist.id, artist.user_id)
              return (
                <tr
                  key={artist.id}
                  className="border-t border-white/[0.04] hover:bg-white/[0.025] transition"
                >
                  {/* Name + avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {artist.image ? (
                        <img
                          src={artist.image}
                          alt={artist.name}
                          className="w-8 h-8 rounded-full object-cover bg-gray-800 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-kcb-ardoise border border-white/[0.06] flex items-center justify-center text-kcb-pierre text-xs flex-shrink-0">
                          {artist.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="text-white font-medium leading-tight">
                        {artist.name ?? '—'}
                      </span>
                    </div>
                  </td>

                  {/* Country */}
                  <td className="px-4 py-3 text-kcb-pierre">{artist.country ?? '—'}</td>

                  {/* Medium */}
                  <td className="px-4 py-3 text-kcb-pierre text-xs max-w-[140px] truncate">
                    {artist.medium ?? '—'}
                  </td>

                  {/* Artworks count */}
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1 text-white">
                      <Image className="w-3 h-3 text-kcb-pierre" />
                      {stats.total}
                    </span>
                  </td>

                  {/* Certified count */}
                  <td className="px-4 py-3 text-center">
                    {stats.certified > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-900/30 border border-green-500/20 text-green-400 text-xs">
                        <Shield className="w-3 h-3" />
                        {stats.certified}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Link */}
                  <td className="px-4 py-3 text-center">
                    <a
                      href={`/artist/${artist.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Voir la page publique"
                      className="inline-flex items-center justify-center p-1 rounded text-kcb-pierre hover:text-white transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              )
            })}

            {paged.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-kcb-pierre">
                  {search
                    ? 'Aucun artiste correspond à la recherche.'
                    : 'Aucun artiste enregistré.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-kcb-pierre">
          <span>{filtered.length} artistes</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 rounded border border-white/[0.06] hover:border-white/20 disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white text-xs px-1">
              {page} / {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded border border-white/[0.06] hover:border-white/20 disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
