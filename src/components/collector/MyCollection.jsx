/**
 * MyCollection.jsx — Complete collector collection view
 * Supports filtering, sorting, grid/list toggle
 */

import { useState } from 'react'
import { useCollection } from '../../api/useCollectionQuery'
import { Grid, List, ChevronDown } from 'lucide-react'

export default function MyCollection() {
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [filters, setFilters] = useState({
    artist: '',
    medium: '',
    source: '', // 'bought' or 'digitized'
    year_from: '',
    year_to: '',
  })
  const [sort, setSort] = useState('date_desc')
  const [page, setPage] = useState(0)

  const { data, isLoading, error } = useCollection(filters, sort, page)
  const artworks = data?.artworks || []
  const totalCount = data?.count || 0

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(0) // Reset to page 0 on filter change
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Ma Collection</h1>
          <p className="text-kcb-pierre">
            {totalCount} œuvre{totalCount !== 1 ? 's' : ''} possédée{totalCount !== 1 ? 's' : ''}
            {data?.total_value && ` • Valeur: $${(data.total_value / 1000).toFixed(1)}k`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-[4px] transition ${
              viewMode === 'grid'
                ? 'bg-kcb-or text-kcb-noir'
                : 'bg-kcb-ardoise text-kcb-pierre hover:text-white'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-[4px] transition ${
              viewMode === 'list'
                ? 'bg-kcb-or text-kcb-noir'
                : 'bg-kcb-ardoise text-kcb-pierre hover:text-white'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Artiste"
            value={filters.artist}
            onChange={(e) => handleFilterChange('artist', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          />
          <input
            type="text"
            placeholder="Médium"
            value={filters.medium}
            onChange={(e) => handleFilterChange('medium', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          />
          <select
            value={filters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          >
            <option value="">Source: Tous</option>
            <option value="bought">Acheté sur Bridge</option>
            <option value="digitized">Numérisé par Kucibok</option>
          </select>
          <input
            type="number"
            placeholder="Année de"
            value={filters.year_from}
            onChange={(e) => handleFilterChange('year_from', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          />
          <input
            type="number"
            placeholder="Année à"
            value={filters.year_to}
            onChange={(e) => handleFilterChange('year_to', e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
          />
        </div>
        <div>
          <label className="text-sm text-kcb-pierre mb-2 block">Tri</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or w-full md:w-48"
          >
            <option value="date_desc">Date d'acquisition (récent)</option>
            <option value="date_asc">Date d'acquisition (ancien)</option>
            <option value="value_desc">Valeur (élevée)</option>
            <option value="value_asc">Valeur (basse)</option>
            <option value="artist_asc">Artiste (A-Z)</option>
            <option value="artist_desc">Artiste (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-900 rounded-[4px] p-4 text-red-300 text-sm">
          {error.message}
        </div>
      )}

      {!isLoading && artworks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-kcb-pierre mb-4">Aucune œuvre trouvée</p>
          <p className="text-sm text-kcb-sable">Explorez le catalogue pour ajouter à votre collection</p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && artworks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {artworks.map((artwork) => (
            <div
              key={artwork.id}
              className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-white/[0.12] transition cursor-pointer group"
            >
              <img
                src={artwork.image_url || '/images/placeholder-artwork.svg'}
                alt={artwork.title}
                className="w-full h-48 object-cover group-hover:opacity-80 transition"
              />
              <div className="p-4">
                <h3 className="text-white font-medium text-sm truncate mb-1">{artwork.title}</h3>
                <p className="text-kcb-pierre text-xs mb-2">{artwork.artist_name}</p>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-kcb-pierre text-xs">{artwork.medium}</p>
                    <p className="text-kcb-pierre text-xs">{artwork.year}</p>
                  </div>
                  <span className="text-kcb-or text-xs font-medium bg-kcb-noir rounded px-2 py-1">
                    {artwork.source === 'bought' ? 'Acheté' : 'Numérisé'}
                  </span>
                </div>
                {artwork.price_documented && (
                  <p className="text-white font-medium text-sm mt-2">${artwork.price_documented}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && artworks.length > 0 && (
        <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.06]">
              <tr>
                <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Titre</th>
                <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Artiste</th>
                <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Médium</th>
                <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Année</th>
                <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Prix</th>
                <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Source</th>
                <th className="text-left px-4 py-3 text-kcb-pierre font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {artworks.map((artwork) => (
                <tr
                  key={artwork.id}
                  className="border-b border-white/[0.06] hover:bg-kcb-noir transition cursor-pointer"
                >
                  <td className="px-4 py-3 text-white truncate max-w-xs">{artwork.title}</td>
                  <td className="px-4 py-3 text-kcb-pierre">{artwork.artist_name}</td>
                  <td className="px-4 py-3 text-kcb-pierre">{artwork.medium}</td>
                  <td className="px-4 py-3 text-kcb-pierre">{artwork.year}</td>
                  <td className="px-4 py-3 text-kcb-or font-medium">
                    {artwork.price_documented ? `$${artwork.price_documented}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-1 bg-kcb-ardoise rounded">
                      {artwork.source === 'bought' ? 'Acheté' : 'Numérisé'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-kcb-pierre">
                    {new Date(artwork.acquisition_date).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 20 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] text-white disabled:opacity-50 hover:border-white/[0.12] transition"
          >
            Précédent
          </button>
          <span className="px-4 py-2 text-kcb-pierre text-sm">
            Page {page + 1}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * 20 + 20 >= totalCount}
            className="px-4 py-2 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] text-white disabled:opacity-50 hover:border-white/[0.12] transition"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  )
}
