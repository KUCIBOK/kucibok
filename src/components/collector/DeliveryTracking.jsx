/**
 * DeliveryTracking.jsx — Delivery tracking for collector
 * Only shows artworks that need physical delivery (not digitized)
 */

import { useAuth } from '../../store/AuthContext'
import { useBoughtArtworks } from '../../api/useDashboardArtworksQuery'
import { Truck, Package, CheckCircle, AlertCircle } from 'lucide-react'

const STATUS_CONFIG = {
  pending: { label: 'En attente', icon: Package, color: 'text-yellow-400' },
  in_transit: { label: 'En transit', icon: Truck, color: 'text-blue-400' },
  delivered: { label: 'Livré', icon: CheckCircle, color: 'text-green-400' },
  issue: { label: 'Problème', icon: AlertCircle, color: 'text-red-400' },
}

export default function DeliveryTracking() {
  const { user } = useAuth()
  const { data: boughtArtworks } = useBoughtArtworks()

  // Filter artworks that need delivery (not digitized)
  const artworksNeedingDelivery = (boughtArtworks || []).filter((artwork) => !artwork.is_digitized)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Logistique</h1>
        <p className="text-kcb-pierre">
          {artworksNeedingDelivery.length} expédition{artworksNeedingDelivery.length !== 1 ? 's' : ''} en cours
        </p>
      </div>

      {/* Content */}
      {artworksNeedingDelivery.length === 0 && (
        <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] p-8 text-center">
          <Package className="w-12 h-12 text-kcb-pierre mx-auto mb-4 opacity-50" />
          <p className="text-kcb-pierre mb-2">Aucune expédition actuellement</p>
          <p className="text-sm text-kcb-sable">
            Les œuvres numérisées n'ont pas besoin de livraison physique
          </p>
        </div>
      )}

      {/* Deliveries */}
      {artworksNeedingDelivery.length > 0 && (
        <div className="space-y-4">
          {artworksNeedingDelivery.map((artwork) => {
            const statusInfo = STATUS_CONFIG[artwork.delivery_status] || STATUS_CONFIG.pending
            const StatusIcon = statusInfo.icon

            return (
              <div
                key={artwork.id}
                className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] overflow-hidden hover:border-white/[0.12] transition"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 md:p-6">
                  {/* Artwork Image */}
                  <div className="md:col-span-1">
                    <img
                      src={artwork.image_url || '/images/placeholder-artwork.svg'}
                      alt={artwork.title}
                      className="w-full h-32 object-cover rounded-[4px]"
                    />
                  </div>

                  {/* Artwork Info */}
                  <div className="md:col-span-2">
                    <h3 className="text-white font-medium mb-1">{artwork.title}</h3>
                    <p className="text-kcb-pierre text-sm mb-2">{artwork.artist_name}</p>

                    {/* Timeline */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-xs text-kcb-pierre">Commande passée</span>
                        <span className="text-xs text-kcb-sable">
                          {new Date(artwork.order_date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            artwork.delivery_status !== 'pending' ? 'bg-blue-400' : 'bg-gray-600'
                          }`}
                        />
                        <span className="text-xs text-kcb-pierre">Préparation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            ['in_transit', 'delivered'].includes(artwork.delivery_status)
                              ? 'bg-blue-400'
                              : 'bg-gray-600'
                          }`}
                        />
                        <span className="text-xs text-kcb-pierre">Expédition</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            artwork.delivery_status === 'delivered'
                              ? 'bg-green-400'
                              : 'bg-gray-600'
                          }`}
                        />
                        <span className="text-xs text-kcb-pierre">Livraison</span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="md:col-span-1">
                    <div className="flex flex-col items-end gap-4">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                        <div>
                          <p className="text-white font-medium text-sm text-right">
                            {statusInfo.label}
                          </p>
                          {artwork.estimated_delivery && (
                            <p className="text-xs text-kcb-pierre text-right">
                              Avant le{' '}
                              {new Date(artwork.estimated_delivery).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>

                      {artwork.tracking_number && (
                        <a
                          href={`https://track.logidoo.com/${artwork.tracking_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-kcb-or text-xs font-medium hover:underline"
                        >
                          Suivi ({artwork.tracking_number})
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Issue Message */}
                {artwork.delivery_status === 'issue' && artwork.issue_message && (
                  <div className="border-t border-white/[0.06] bg-red-900/20 p-4">
                    <p className="text-red-300 text-sm">
                      <strong>Problème:</strong> {artwork.issue_message}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
