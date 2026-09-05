/**
 * DashboardHome.jsx — Collector dashboard homepage
 * Displays: greeting, 4 stat cards, preview sections
 */

import { useAuth } from '../../store/AuthContext'
import { useCollectionSummary, useRecentAcquisitions } from '../../api/useCollectionQuery'
import { useFollowedArtists } from '../../api/useFollowedArtistsQuery'
import { usePriorityAccessArtworks } from '../../api/useDashboardArtworksQuery'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Users, Package, TrendingUp } from 'lucide-react'

export default function DashboardHome() {
  const { user } = useAuth()
  const { data: collectionSummary } = useCollectionSummary()
  const { data: followedArtists } = useFollowedArtists()
  const { data: recentAcquisitions } = useRecentAcquisitions(3)
  const { data: priorityAccess } = usePriorityAccessArtworks()

  const firstName = user?.name?.split(' ')[0] || 'Collectionneur'

  // Stat cards — only show if data exists
  const statCards = [
    {
      label: 'Œuvres possédées',
      value: collectionSummary?.total_artworks || 0,
      icon: <Package className="w-6 h-6" />,
      path: '/account/collection',
    },
    {
      label: 'Artistes suivis',
      value: followedArtists?.count || 0,
      icon: <Users className="w-6 h-6" />,
      path: '/account/followed-artists',
    },
    {
      label: 'Nouveaux dossiers ce mois',
      value: priorityAccess?.count || 0,
      icon: <Zap className="w-6 h-6" />,
      path: '/account/discovery',
    },
    // Valeur totale — only show if real data source exists
    ...(collectionSummary?.total_value
      ? [
          {
            label: 'Valeur totale collection',
            value: `$${(collectionSummary.total_value / 1000).toFixed(1)}k`,
            icon: <TrendingUp className="w-6 h-6" />,
            path: '/account/collection',
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Bonsoir, {firstName}.</h1>
        <p className="text-kcb-pierre">Collectionneur · abonné depuis {new Date(user?.created_at).toLocaleDateString('fr-FR')}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Link
            key={i}
            to={card.path}
            className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-6 hover:border-white/[0.12] transition group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-kcb-pierre text-sm">{card.label}</div>
              <div className="text-kcb-or group-hover:scale-110 transition">
                {card.icon}
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{card.value}</div>
          </Link>
        ))}
      </div>

      {/* Nouveautés pour vous */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Nouveautés pour vous</h2>
          <Link
            to="/account/discovery"
            className="text-kcb-or text-sm font-medium hover:underline flex items-center gap-1"
          >
            Voir tout
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {priorityAccess?.artworks?.slice(0, 3).map((artwork) => (
            <div
              key={artwork.id}
              className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-white/[0.12] transition"
            >
              <img
                src={artwork.image_url || '/images/placeholder-artwork.svg'}
                alt={artwork.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-white font-medium truncate">{artwork.title}</h3>
                <p className="text-kcb-pierre text-sm">{artwork.artist_name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ma Collection aperçu */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Ma Collection</h2>
          <Link
            to="/account/collection"
            className="text-kcb-or text-sm font-medium hover:underline flex items-center gap-1"
          >
            Voir tout ({collectionSummary?.total_artworks || 0})
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentAcquisitions?.artworks?.map((artwork) => (
            <div
              key={artwork.id}
              className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-white/[0.12] transition"
            >
              <img
                src={artwork.image_url || '/images/placeholder-artwork.svg'}
                alt={artwork.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-white font-medium truncate">{artwork.title}</h3>
                <p className="text-kcb-pierre text-sm mb-2">{artwork.artist_name}</p>
                <p className="text-kcb-or text-xs font-medium">
                  {new Date(artwork.acquisition_date).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Artistes suivis */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Artistes suivis</h2>
          <Link
            to="/account/followed-artists"
            className="text-kcb-or text-sm font-medium hover:underline flex items-center gap-1"
          >
            Gérer ({followedArtists?.count || 0})
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {followedArtists?.artists?.slice(0, 5).map((artist) => (
            <div
              key={artist.id}
              className="flex items-center gap-4 bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-3 hover:border-white/[0.12] transition"
            >
              {artist.image && (
                <img
                  src={artist.image}
                  alt={artist.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="text-white font-medium">{artist.name}</h3>
                {artist.has_new_work && (
                  <span className="text-xs text-kcb-or font-medium">Nouvelle œuvre disponible</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Certificats preview (grisé) */}
      <section className="opacity-50 pointer-events-none">
        <h2 className="text-xl font-semibold text-white mb-4">Certificats</h2>
        <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-6 text-center">
          <p className="text-kcb-pierre">Les certificats seront disponibles bientôt</p>
        </div>
      </section>
    </div>
  )
}
