/**
 * DiscoveryCatalogue.jsx — Discovery & Catalogue for collectors
 * Tab 1: Priority access artworks (nouveaux dossiers)
 * Tab 2: Full catalogue with filters
 */

import { useState } from 'react'
import { usePriorityAccessArtworks } from '../../api/useDashboardArtworksQuery'
import { useFollowArtistMutation } from '../../api/useFollowedArtistsQuery'
import { Heart, Plus } from 'lucide-react'

export default function DiscoveryCatalogue() {
  const [activeTab, setActiveTab] = useState('priority')
  const [catalogueFilters, setCatalogueFilters] = useState({
    medium: '',
    country: '',
    price_min: '',
    price_max: '',
  })

  const { data: priorityData, isLoading: priorityLoading } = usePriorityAccessArtworks()
  const { mutate: followArtist } = useFollowArtistMutation()

  const [favoritedIds, setFavoritedIds] = useState(new Set())

  const handleFollowArtist = (artistId) => {
    followArtist(artistId)
  }

  const toggleFavorite = (artworkId) => {
    const newFavorites = new Set(favoritedIds)
    if (newFavorites.has(artworkId)) {
      newFavorites.delete(artworkId)
    } else {
      newFavorites.add(artworkId)
    }
    setFavoritedIds(newFavorites)
  }

  const priorityArtworks = priorityData?.artworks || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Découverte</h1>
        <p className="text-kcb-pierre">Explorez les nouvelles œuvres et le catalogue complet</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab('priority')}
          className={`px-4 py-3 font-medium transition border-b-2 ${
            activeTab === 'priority'
              ? 'border-kcb-or text-white'
              : 'border-transparent text-kcb-pierre hover:text-white'
          }`}
        >
          Nouveaux dossiers
        </button>
        <button
          onClick={() => setActiveTab('catalogue')}
          className={`px-4 py-3 font-medium transition border-b-2 ${
            activeTab === 'catalogue'
              ? 'border-kcb-or text-white'
              : 'border-transparent text-kcb-pierre hover:text-white'
          }`}
        >
          Catalogue complet
        </button>
      </div>

      {/* Priority Access Tab */}
      {activeTab === 'priority' && (
        <div className="space-y-6">
          <p className="text-kcb-pierre text-sm">
            Accès en priorité aux nouveaux dossiers reçus sur la plateforme
          </p>

          {priorityLoading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-kcb-or border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!priorityLoading && priorityArtworks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-kcb-pierre mb-4">Aucun nouveau dossier pour le moment</p>
              <p className="text-sm text-kcb-sable">Revenez bientôt pour découvrir les nouveautés</p>
            </div>
          )}

          {priorityArtworks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {priorityArtworks.map((artwork) => (
                <div
                  key={artwork.id}
                  className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-white/[0.12] transition group"
                >
                  <div className="relative">
                    <img
                      src={artwork.image_url || '/images/placeholder-artwork.svg'}
                      alt={artwork.title}
                      className="w-full h-48 object-cover group-hover:opacity-80 transition"
                    />
                    <button
                      onClick={() => toggleFavorite(artwork.id)}
                      className="absolute top-2 right-2 p-2 rounded-full bg-kcb-noir/80 hover:bg-kcb-noir transition opacity-0 group-hover:opacity-100"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          favoritedIds.has(artwork.id)
                            ? 'fill-kcb-or text-kcb-or'
                            : 'text-kcb-pierre'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-medium text-sm truncate mb-1">{artwork.title}</h3>
                    <p className="text-kcb-pierre text-xs mb-3">{artwork.artist_name}</p>
                    <button
                      onClick={() => handleFollowArtist(artwork.artist_id)}
                      className="w-full px-3 py-2 bg-kcb-noir border border-kcb-or text-kcb-or text-xs font-medium rounded-[4px] hover:bg-kcb-or hover:text-kcb-noir transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Suivre l'artiste
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Catalogue Tab */}
      {activeTab === 'catalogue' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={catalogueFilters.medium}
                onChange={(e) => setCatalogueFilters({ ...catalogueFilters, medium: e.target.value })}
                className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
              >
                <option value="">Médium: Tous</option>
                <option value="painting">Peinture</option>
                <option value="sculpture">Sculpture</option>
                <option value="photography">Photographie</option>
                <option value="mixed_media">Art mixte</option>
              </select>
              <select
                value={catalogueFilters.country}
                onChange={(e) => setCatalogueFilters({ ...catalogueFilters, country: e.target.value })}
                className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
              >
                <option value="">Pays: Tous</option>
                <option value="senegal">Sénégal</option>
                <option value="nigeria">Nigeria</option>
                <option value="egypt">Égypte</option>
                <option value="south_africa">Afrique du Sud</option>
              </select>
              <input
                type="number"
                placeholder="Prix min"
                value={catalogueFilters.price_min}
                onChange={(e) => setCatalogueFilters({ ...catalogueFilters, price_min: e.target.value })}
                className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
              />
              <input
                type="number"
                placeholder="Prix max"
                value={catalogueFilters.price_max}
                onChange={(e) => setCatalogueFilters({ ...catalogueFilters, price_max: e.target.value })}
                className="px-3 py-2 bg-kcb-noir border border-white/[0.06] rounded-[4px] text-white text-sm focus:outline-none focus:border-kcb-or"
              />
            </div>
          </div>

          {/* Placeholder */}
          <div className="text-center py-12">
            <p className="text-kcb-pierre mb-4">Catalogue complet en développement</p>
            <p className="text-sm text-kcb-sable">
              Pour l'instant, explorez les nouveaux dossiers ou visitez le catalogue principal
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
