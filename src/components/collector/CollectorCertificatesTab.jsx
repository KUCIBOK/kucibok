import { useMemo } from 'react'
import { ShieldCheck, Shield, ExternalLink, FileQuestion, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCollectorView } from '../../api/useCollectorArtworksQuery'; import { useMyArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */
import { KPICard, SkeletonTable, EmptyState } from '../ui'
import { useT } from '../../i18n'
import { buyerT } from '../../i18n/buyer'

function CertBadge({ kucibok_id, t }) {
  if (kucibok_id) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30">
        <ShieldCheck className="w-3 h-3" /> {t.badgeCertified}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
      <Shield className="w-3 h-3" /> {t.badgeNotCertified}
    </span>
  )
}

/**
 * Onglet Mes Certificats — dashboard Collectionneur.
 * Affiche les certificats KCB des œuvres achetées et de la collection personnelle.
 */
export function CollectorCertificatesTab() {
  const { buyed } = useCollectorView(); const { data: myArtworks = [], isLoading: loading } = useMyArtworks() /* ✨ React Query */
  const t = useT(buyerT).certificates

  // Fusion achats + collection, déduplication par id
  const allArtworks = useMemo(() => {
    const map = new Map()
    ;[...(buyed ?? []), ...(myArtworks ?? [])].forEach((a) => map.set(a.id ?? a._id, a))
    return Array.from(map.values())
  }, [buyed, myArtworks])

  const certified = useMemo(() => allArtworks.filter((a) => !!a.kucibok_id), [allArtworks])
  const pending = useMemo(() => allArtworks.filter((a) => !a.kucibok_id), [allArtworks])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-900/20 text-green-400 p-2.5 rounded-[4px]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{t.heading}</h2>
            <p className="text-sm text-kcb-pierre">{t.subheading}</p>
          </div>
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-green-900/20 text-green-400 p-2.5 rounded-[4px]">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{t.heading}</h2>
          <p className="text-sm text-kcb-pierre">{t.subheading}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label={t.kpiTotal}
          value={allArtworks.length}
          icon={<Shield className="w-4 h-4" />}
        />
        <KPICard
          label={t.kpiCertified}
          value={certified.length}
          icon={<ShieldCheck className="w-4 h-4" />}
          accent="green"
        />
        <KPICard
          label={t.kpiPending}
          value={pending.length}
          icon={<Shield className="w-4 h-4" />}
          accent="yellow"
        />
      </div>

      {/* Liste */}
      {allArtworks.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t.emptyTitle}
          description={t.emptyDescription}
          actionLabel={t.emptyAction}
          onAction={() => window.location.assign('/africa/catalogue')}
        />
      ) : (
        <div className="space-y-3">
          {allArtworks.map((artwork) => (
            <div
              key={artwork.id ?? artwork._id}
              className="flex items-center gap-4 p-4 rounded-[4px] border border-white/[0.06] bg-kcb-ardoise/40 hover:bg-kcb-ardoise/60 transition-colors"
            >
              {/* Image */}
              <div className="w-14 h-14 rounded-[4px] overflow-hidden flex-shrink-0 bg-kcb-ardoise">
                {artwork.image ? (
                  <img
                    src={artwork.image}
                    alt={artwork.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-kcb-pierre">
                    <Shield className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{artwork.title}</p>
                <p className="text-kcb-pierre text-xs mt-0.5">
                  {artwork.kucibok_id ?? 'Certificat non encore émis'}
                </p>
              </div>

              {/* Badge */}
              <CertBadge kucibok_id={artwork.kucibok_id} />

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {artwork.kucibok_id && (
                  <>
                    <Link
                      to={`/verify/${artwork.kucibok_id}`}
                      target="_blank"
                      className="p-1.5 rounded-[4px] text-kcb-pierre hover:text-white hover:bg-white/[0.06] transition-colors"
                      title="Vérifier le certificat"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    {artwork.certificate_url && (
                      <a
                        href={artwork.certificate_url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="p-1.5 rounded-[4px] text-kcb-pierre hover:text-kcb-or hover:bg-kcb-or/10 transition-colors"
                        title="Télécharger le PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
