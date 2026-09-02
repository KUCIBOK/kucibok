import { Bookmark, Clock, CreditCard, Image, Package, TrendingUp, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCollectorView } from '../../api/useCollectorArtworksQuery' /* ✨ React Query */
import { useAuth } from '../../store/AuthContext'
import { useDelivery } from '../../store/DeliveryStore'
import { AddArtistAction } from '../professional/AddArtistAction'
import { CreateCollection } from '../artworks/CreateCollection'
import { KPICard, SkeletonKPI, EmptyState } from '../ui'
import { useT } from '../../i18n'
import { buyerT } from '../../i18n/buyer'

/** Status considérés comme une livraison active (non finalisée). */
const ACTIVE_STATUSES = ['pending', 'in_transit', 'processing', 'shipped']

function DeliveryStatusBadge({ status, t }) {
  const STATUS_MAP = {
    pending: { label: t.statusPending, cls: 'bg-yellow-900/40 text-yellow-300' },
    processing: { label: t.statusProcessing, cls: 'bg-kcb-or/20 text-kcb-sable' },
    shipped: { label: t.statusShipped, cls: 'bg-kcb-or/20 text-kcb-sable' },
    in_transit: { label: t.statusInTransit, cls: 'bg-kcb-bronze/20 text-kcb-sable' },
    delivered: { label: t.statusDelivered, cls: 'bg-green-900/40 text-green-300' },
  }
  const cfg = STATUS_MAP[status] ?? { label: status, cls: 'bg-kcb-ardoise text-kcb-pierre' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-[2px] ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

/**
 * Vue synthèse du dashboard collecteur.
 *
 * Affiche 4 KPIs (œuvres, valeur, livraisons actives, plan),
 * des actions rapides, les 3 dernières acquisitions et les livraisons en cours.
 *
 * @returns {JSX.Element}
 */
export function Synthesis() {
  const { buyed, loading: artworksLoading } = useCollectorView() /* ✨ React Query */
  const { subscription } = useAuth()
  const { deliveries } = useDelivery()
  const t = useT(buyerT).synthesis

  const totalValue = buyed?.reduce((acc, artwork) => acc + (artwork.price || 0), 0) ?? 0

  const activeDeliveries = deliveries?.filter((d) => ACTIVE_STATUSES.includes(d.status)) ?? []

  const lastAcquisitions = [...(buyed ?? [])].slice(0, 3)

  const planName = subscription?.planName || 'Gratuit'

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {artworksLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            icon={Bookmark}
            label={t.kpiArtworks}
            value={buyed?.length ?? 0}
            iconColor="text-kcb-bronze"
            iconBgColor="bg-kcb-bronze/10"
          />
          <KPICard
            icon={TrendingUp}
            label={t.kpiValue}
            value={`${totalValue.toLocaleString()} CFA`}
            iconColor="text-green-400"
            iconBgColor="bg-green-900/20"
          />
          <KPICard
            icon={Truck}
            label={t.kpiDeliveries}
            value={activeDeliveries.length}
            iconColor="text-kcb-or"
            iconBgColor="bg-kcb-or/10"
          />
          <KPICard
            icon={CreditCard}
            label={t.kpiPlan}
            value={planName}
            iconColor="text-amber-400"
            iconBgColor="bg-amber-900/20"
          />
        </div>
      )}

      {/* Actions rapides */}
      <div className="rounded-[4px] border border-white/[0.06] bg-kcb-ardoise p-4">
        <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
          <Clock className="w-5 h-5 text-kcb-pierre" />
          {t.headingActions}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/africa/catalogue"
            className="flex items-center justify-center gap-2 rounded-[4px] border border-white/[0.06] bg-kcb-ardoise/50 hover:bg-white/[0.08] text-kcb-sable text-sm font-medium py-3 px-4 transition-colors duration-200"
          >
            <Image className="w-4 h-4" />
            {t.linkExplore}
          </Link>
          <AddArtistAction />
          <CreateCollection />
        </div>
      </div>

      {/* Dernières acquisitions */}
      <div className="rounded-[4px] border border-white/[0.06] bg-kcb-ardoise p-4">
        <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
          <Package className="w-5 h-5 text-kcb-pierre" />
          {t.headingAcquisitions}
        </h3>
        {lastAcquisitions.length === 0 ? (
          <EmptyState
            icon={Image}
            title={t.emptyAcqTitle}
            description={t.emptyAcqDescription}
            actionLabel={t.emptyAcqAction}
            onAction={() => window.location.assign('/africa/catalogue')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {lastAcquisitions.map((artwork) => (
              <div
                key={artwork.id || artwork._id}
                className="flex items-center gap-3 rounded-[4px] border border-white/[0.06] bg-kcb-ardoise-cool p-3 hover:border-white/[0.06] transition-colors duration-200"
              >
                {/* Thumbnail */}
                {artwork.image ? (
                  <img
                    src={artwork.image}
                    alt={artwork.title}
                    className="w-14 h-14 rounded-[4px] object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-[4px] bg-kcb-ardoise flex items-center justify-center flex-shrink-0">
                    <Image className="w-6 h-6 text-kcb-pierre" />
                  </div>
                )}
                {/* Info */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {artwork.title || t.noTitle}
                  </p>
                  <p className="text-xs text-kcb-pierre truncate">
                    {artwork.artist?.name || artwork.artistName || '—'}
                  </p>
                  <p className="text-xs text-kcb-or font-semibold mt-0.5">
                    {artwork.price ? `${artwork.price.toLocaleString('fr-FR')} CFA` : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Livraisons en cours */}
      <div className="rounded-[4px] border border-white/[0.06] bg-kcb-ardoise p-4">
        <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
          <Truck className="w-5 h-5 text-kcb-pierre" />
          {t.headingDeliveries}
        </h3>
        {activeDeliveries.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={t.emptyDeliveryTitle}
            description={t.emptyDeliveryDescription}
          />
        ) : (
          <ul className="space-y-2">
            {activeDeliveries.map((delivery) => (
              <li
                key={delivery._id}
                className="flex items-center justify-between rounded-[4px] border border-white/[0.06] bg-kcb-ardoise-cool px-4 py-3 hover:border-white/[0.06] transition-colors duration-200"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {delivery.artworkTitle ||
                      delivery.description ||
                      t.deliveryDefaultTitle(delivery._id?.slice(-6))}
                  </p>
                  <p className="text-xs text-kcb-pierre mt-0.5">
                    {delivery.destination || t.unknownDestination}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <DeliveryStatusBadge status={delivery.status} t={t} />
                  <Link
                    to={`/tracking/${delivery._id}`}
                    className="text-xs text-kcb-or hover:text-kcb-or/80 transition-colors"
                  >
                    {t.deliveryTrack}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
