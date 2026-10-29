import { useAdminStats } from '../../api/useAdminStatsQuery' /* ✨ React Query */
import { SkeletonKPI, ErrorState } from '../ui'
import { RefreshCw, Users, Package, CreditCard } from 'lucide-react'
import { useT } from '../../i18n'
import { adminT } from '../../i18n/admin'

const fmtInt = (n) => Number(n ?? 0).toLocaleString('fr-FR')

/**
 * Tableau de bord admin — uniquement des données réelles issues de /api/admin/stats.
 * Aucun chiffre de remplacement : si l'API échoue, une erreur est affichée.
 */
export function Analytics({ onOpenPending, onOpenUsers }) {
  const t = useT(adminT).analytics
  const { stats, loading, error, refresh } = useAdminStats()

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">{t.title}</h1>
          {stats?.lastUpdated && (
            <p className="text-kcb-pierre mt-1 text-sm">
              màj{' '}
              {new Date(stats.lastUpdated).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 bg-kcb-or hover:bg-kcb-bronze rounded text-kcb-noir text-xs font-medium transition flex items-center gap-1 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t.refresh}
        </button>
      </div>

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonKPI key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState
          title="Impossible de charger les statistiques"
          error={error}
          onRetry={refresh}
        />
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI icon={Users} label={t.users} value={fmtInt(stats.totalUsers)} />
            <KPI icon={Package} label={t.artworks} value={fmtInt(stats.totalArtworks)} />
            <KPI
              icon={Package}
              label="En attente de validation"
              value={fmtInt(stats.pendingArtworks)}
            />
            <KPI
              icon={CreditCard}
              label="Abonnements actifs"
              value={fmtInt(stats.activeSubscriptions)}
              hint={`${fmtInt(stats.totalSubscriptions)} au total`}
            />
          </div>

          <Section title="Utilisateurs par rôle">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI label="Artistes" value={fmtInt(stats.artists)} />
              <KPI label="Collectionneurs" value={fmtInt(stats.collectors)} />
              <KPI label="Curateurs" value={fmtInt(stats.professionals)} />
              <KPI label="Advisors" value={fmtInt(stats.advisors)} />
            </div>
          </Section>

          <Section title="Œuvres par statut">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI label="Approuvées" value={fmtInt(stats.approvedArtworks)} />
              <KPI label="En attente" value={fmtInt(stats.pendingArtworks)} />
              <KPI label="Rejetées" value={fmtInt(stats.rejectedArtworks)} />
              <KPI label="Total" value={fmtInt(stats.totalArtworks)} />
            </div>
          </Section>

          <Section title="Actions rapides">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionButton
                label="Réviser les œuvres"
                description="Œuvres en attente de validation"
                badge={fmtInt(stats.pendingArtworks)}
                onClick={onOpenPending}
              />
              <ActionButton
                label="Gérer les utilisateurs"
                description="Comptes, rôles et abonnements"
                badge={fmtInt(stats.totalUsers)}
                onClick={onOpenUsers}
              />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white font-playfair border-b border-white/[0.06] pb-2">
        {title}
      </h2>
      {children}
    </div>
  )
}

function KPI({ icon: Icon, label, value, hint }) {
  return (
    <div className="bg-kcb-ardoise border border-white/[0.08] rounded-[4px] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-kcb-pierre text-sm font-medium">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-kcb-or" />}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {hint && <p className="text-xs text-kcb-pierre/80">{hint}</p>}
    </div>
  )
}

function ActionButton({ label, description, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-kcb-ardoise/50 border border-white/[0.06] hover:border-kcb-or/50 rounded-[4px] p-4 text-left transition group w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-white font-semibold group-hover:text-kcb-or transition">{label}</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-kcb-or/20 text-kcb-or border border-kcb-or/30">
          {badge}
        </span>
      </div>
      <p className="text-kcb-pierre text-xs">{description}</p>
    </button>
  )
}
