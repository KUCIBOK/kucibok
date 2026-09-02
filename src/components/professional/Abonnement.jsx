import { useState, useEffect } from 'react'
import {
  CreditCard,
  Check,
  X,
  Zap,
  Crown,
  Shield,
  Users,
  Image,
  HardDrive,
  BarChart3,
  ArrowUp,
  AlertTriangle,
  Package,
  Clock,
  TrendingUp,
  Bell,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useMyArtworks } from '../../api/useAdminArtworksQuery' /* ✨ React Query */
import { useArtist } from '../../store/ArtistContext'
import { cancelMySubscription } from '../../api/useSubscriptions'

// Plan features limits
const PLAN_LIMITS = {
  free: {
    name: 'Gratuit',
    price: 0,
    maxArtists: 3,
    maxArtworks: 10,
    maxStorage: 100,
    features: [
      '3 artistes maximum',
      '10 oeuvres maximum',
      '100MB stockage',
      'Support par email',
      'Statistiques basiques',
    ],
  },
  starter: {
    name: 'Starter',
    price: 9900,
    maxArtists: 10,
    maxArtworks: 50,
    maxStorage: 500,
    features: [
      '10 artistes',
      '50 oeuvres',
      '500MB stockage',
      'Support prioritaire',
      'CRM basique',
      'Statistiques avancées',
    ],
  },
  pro: {
    name: 'Pro',
    price: 19900,
    maxArtists: 50,
    maxArtworks: 200,
    maxStorage: 2000,
    features: [
      '50 artistes',
      '200 oeuvres',
      '2GB stockage',
      'Support VIP',
      'CRM complet',
      'Analytique Pro',
      'Multi-entité',
      'Intégrations API',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 49900,
    maxArtists: -1,
    maxArtworks: -1,
    maxStorage: -1,
    features: [
      'Artistes illimités',
      'Oeuvres illimitées',
      'Stockage illimité',
      'Support dédié',
      'Toutes fonctionnalités',
      'API complète',
      'Formation incluse',
      'Intégrations sur mesure',
    ],
  },
}

function getPlanKey(planName) {
  if (!planName) return 'free'
  const name = planName.toLowerCase()
  if (name.includes('gratuit') || name === 'free') return 'free'
  if (name.includes('starter')) return 'starter'
  if (name.includes('pro')) return 'pro'
  if (name.includes('enterprise') || name.includes('business')) return 'enterprise'
  return 'free'
}

export function Abonnement() {
  const { subscription, loadSubscription } = useAuth()
  const { data: myArtworks = [] } = useMyArtworks() /* ✨ React Query */
  const { myArtists } = useArtist()
  const [loading, setLoading] = useState(true)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    setLoading(false)
  }, [])

  const daysLeft = subscription?.end_date
    ? Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft > 0

  const handleCancel = async () => {
    setCancelLoading(true)
    setCancelError('')
    const { error } = await cancelMySubscription()
    setCancelLoading(false)
    if (error) {
      setCancelError(error)
      return
    }
    setShowCancelConfirm(false)
    if (typeof loadSubscription === 'function') await loadSubscription()
  }

  const planKey = getPlanKey(subscription?.plan?.name)
  const currentPlan = PLAN_LIMITS[planKey] || PLAN_LIMITS.free

  const artistsCount = myArtists?.length || 0
  const artworksCount = myArtworks?.length || 0
  const storageUsed = Math.round(artworksCount * 5)

  const artistsPercent =
    currentPlan.maxArtists > 0 ? Math.min((artistsCount / currentPlan.maxArtists) * 100, 100) : 0
  const artworksPercent =
    currentPlan.maxArtworks > 0 ? Math.min((artworksCount / currentPlan.maxArtworks) * 100, 100) : 0
  const storagePercent =
    currentPlan.maxStorage > 0 ? Math.min((storageUsed / currentPlan.maxStorage) * 100, 100) : 0

  const needsUpgrade = artistsPercent >= 80 || artworksPercent >= 80 || storagePercent >= 80
  const isAtLimit = artistsPercent >= 100 || artworksPercent >= 100 || storagePercent >= 100

  const getRecommendedUpgrade = () => {
    if (planKey === 'free') return 'starter'
    if (planKey === 'starter') return 'pro'
    if (planKey === 'pro') return 'enterprise'
    return null
  }

  const recommendedPlan = getRecommendedUpgrade()
  const recommendedPlanData = recommendedPlan ? PLAN_LIMITS[recommendedPlan] : null

  const monthsSubscribed = subscription?.created_at
    ? Math.floor((new Date() - new Date(subscription.created_at)) / (1000 * 60 * 60 * 24 * 30))
    : 0
  const currentSpent = monthsSubscribed * currentPlan.price

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kcb-or"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Mon Abonnement</h1>
          <p className="text-kcb-pierre">Gérez votre plan et vos ressources</p>
        </div>
        {!subscription && (
          <Link
            to="/global#pricing"
            className="flex items-center gap-2 bg-kcb-or hover:bg-kcb-bronze text-kcb-noir text-white px-6 py-3 rounded-[4px] transition font-medium"
          >
            <Crown className="w-5 h-5" />
            Voir les plans
          </Link>
        )}
      </div>

      {/* Renewal alert */}
      {isExpiringSoon && (
        <div className="flex items-start gap-3 bg-amber-900/30 border border-amber-700/40 rounded-[4px] px-4 py-3 text-sm">
          <Bell className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200 flex-1">
            Votre abonnement expire dans{' '}
            <strong>
              {daysLeft} jour{daysLeft > 1 ? 's' : ''}
            </strong>
            .{' '}
            <Link to="/global#pricing" className="text-amber-300 underline hover:text-amber-200">
              Renouveler maintenant
            </Link>
          </p>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-gradient-to-r from-kcb-or/10 to-kcb-bronze/10 rounded-[4px] p-6 border border-kcb-or/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold text-white">Plan {currentPlan.name}</h2>
              {planKey === 'free' && (
                <span className="px-2 py-1 bg-kcb-ardoise text-kcb-sable text-xs rounded-full">
                  Actuel
                </span>
              )}
              {planKey !== 'free' && subscription?.status === 'active' && (
                <span className="px-2 py-1 bg-green-700 text-white text-xs rounded-full">
                  Actif
                </span>
              )}
            </div>
            <p className="text-kcb-pierre">
              {currentPlan.price === 0
                ? 'Gratuit pour toujours'
                : `${currentPlan.price.toLocaleString()} CFA/mois`}
            </p>
          </div>
          {subscription?.end_date && (
            <div className="text-right">
              <p className="text-sm text-kcb-pierre">Expire le</p>
              <p className="text-white font-medium">
                {new Date(subscription.end_date).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Alert for limits */}
      {isAtLimit && (
        <div className="bg-red-900/50 border border-red-700 rounded-[4px] p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium">Limite atteinte!</p>
            <p className="text-red-200 text-sm">
              Vous avez atteint les limites de votre plan. Passez à un plan supérieur pour
              continuer.
            </p>
            {recommendedPlanData && (
              <Link
                to="/global#pricing"
                className="inline-flex items-center gap-2 mt-2 text-sm text-red-300 hover:text-red-200 underline"
              >
                <ArrowUp className="w-4 h-4" />
                Passer à {recommendedPlanData.name}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-kcb-ardoise rounded-[4px] p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-kcb-or" />
              <h3 className="font-semibold text-white">Artistes</h3>
            </div>
            <span
              className={`text-sm font-medium ${
                artistsPercent >= 80 ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {artistsPercent.toFixed(0)}%
            </span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-kcb-pierre">Utilisation</span>
              <span className="text-white">
                {artistsCount} / {currentPlan.maxArtists === -1 ? '∞' : currentPlan.maxArtists}
              </span>
            </div>
            <div className="h-2 bg-kcb-ardoise rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  artistsPercent >= 80 ? 'bg-red-500' : 'bg-kcb-or'
                }`}
                style={{ width: `${Math.min(artistsPercent, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-kcb-ardoise rounded-[4px] p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-kcb-bronze" />
              <h3 className="font-semibold text-white">Oeuvres</h3>
            </div>
            <span
              className={`text-sm font-medium ${
                artworksPercent >= 80 ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {artworksPercent.toFixed(0)}%
            </span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-kcb-pierre">Utilisation</span>
              <span className="text-white">
                {artworksCount} / {currentPlan.maxArtworks === -1 ? '∞' : currentPlan.maxArtworks}
              </span>
            </div>
            <div className="h-2 bg-kcb-ardoise rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  artworksPercent >= 80 ? 'bg-red-500' : 'bg-kcb-bronze'
                }`}
                style={{ width: `${Math.min(artworksPercent, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-kcb-ardoise rounded-[4px] p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Stockage</h3>
            </div>
            <span
              className={`text-sm font-medium ${
                storagePercent >= 80 ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {storagePercent.toFixed(0)}%
            </span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-kcb-pierre">Utilisation</span>
              <span className="text-white">
                {storageUsed}MB /{' '}
                {currentPlan.maxStorage === -1 ? '∞' : currentPlan.maxStorage + 'MB'}
              </span>
            </div>
            <div className="h-2 bg-kcb-ardoise rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  storagePercent >= 80 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(storagePercent, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Upgrade Recommendation */}
      {needsUpgrade && !isAtLimit && recommendedPlanData && (
        <div className="bg-kcb-ardoise rounded-[4px] p-6 border border-yellow-700/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-[4px]">
              <Zap className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Recommandation d'upgrade</h3>
              <p className="text-kcb-pierre mb-4">
                Vous avez utilisé plus de 80% de vos ressources. Passez à{' '}
                <strong>{recommendedPlanData.name}</strong> pour bénéficier de:
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                {recommendedPlanData.features.slice(0, 4).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-kcb-sable">
                    <Check className="w-4 h-4 text-green-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/global#pricing"
                className="inline-flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2 rounded-[4px] transition font-medium"
              >
                <ArrowUp className="w-4 h-4" />
                Passer à {recommendedPlanData.name} - {recommendedPlanData.price.toLocaleString()}{' '}
                CFA/mois
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Features */}
      <div className="bg-kcb-ardoise rounded-[4px] p-6 border border-white/[0.06]">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" />
          Inclus dans votre plan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentPlan.features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-kcb-sable">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Billing details */}
      {subscription && (
        <div className="bg-kcb-ardoise rounded-[4px] p-6 border border-white/[0.06]">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-kcb-or" />
            Facturation
          </h3>
          <div className="space-y-0 divide-y divide-white/[0.06]">
            <div className="flex justify-between items-center py-3">
              <span className="text-kcb-pierre text-sm">Statut</span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  subscription.status === 'active'
                    ? 'bg-green-700 text-white'
                    : 'bg-red-800 text-red-200'
                }`}
              >
                {subscription.status === 'active' ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-kcb-pierre text-sm">Plan</span>
              <span className="text-white text-sm font-medium">
                {subscription.plans?.name ?? subscription.plan?.name ?? '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-kcb-pierre text-sm">Montant</span>
              <span className="text-white text-sm font-medium">
                {subscription.amount?.toLocaleString('fr-FR')} {subscription.currency}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-kcb-pierre text-sm">Début</span>
              <span className="text-white text-sm">
                {subscription.start_date
                  ? new Date(subscription.start_date).toLocaleDateString('fr-FR')
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-kcb-pierre text-sm">Fin / Renouvellement</span>
              <span className="text-white text-sm">
                {subscription.end_date
                  ? new Date(subscription.end_date).toLocaleDateString('fr-FR')
                  : '—'}
              </span>
            </div>
            {currentSpent > 0 && (
              <div className="flex justify-between items-center py-3">
                <span className="text-kcb-pierre text-sm">
                  Total versé ({monthsSubscribed} mois)
                </span>
                <span className="text-white text-sm font-semibold">
                  {currentSpent.toLocaleString('fr-FR')} {subscription.currency ?? 'XOF'}
                </span>
              </div>
            )}
          </div>
          {subscription.status === 'active' && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-sm text-red-400 hover:text-red-300 transition"
                >
                  Annuler l'abonnement
                </button>
              ) : (
                <div className="bg-red-900/20 border border-red-700/40 rounded-[4px] p-4 space-y-3">
                  <p className="text-sm text-red-200 font-medium">Confirmer l'annulation ?</p>
                  <p className="text-xs text-red-300/80">
                    Votre accès restera actif jusqu'au{' '}
                    {subscription.end_date
                      ? new Date(subscription.end_date).toLocaleDateString('fr-FR')
                      : '—'}
                    . Cette action est irréversible.
                  </p>
                  {cancelError && <p className="text-xs text-red-400">{cancelError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={cancelLoading}
                      className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-[4px] transition disabled:opacity-50"
                    >
                      {cancelLoading ? 'En cours…' : "Confirmer l'annulation"}
                    </button>
                    <button
                      onClick={() => {
                        setShowCancelConfirm(false)
                        setCancelError('')
                      }}
                      className="px-4 py-1.5 border border-white/10 text-kcb-pierre hover:text-white text-sm rounded-[4px] transition"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upgrade CTA for Free users */}
      {!subscription && (
        <div className="bg-kcb-ardoise rounded-[4px] p-6 border border-white/[0.06] text-center">
          <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            Débloquez toutes les fonctionnalités
          </h3>
          <p className="text-kcb-pierre mb-6 max-w-lg mx-auto">
            Avec un abonnement premium, vous pouvez gérer plus d'artistes, vendre plus d'oeuvres et
            accéder à des outils avancés.
          </p>
          <Link
            to="/global#pricing"
            className="inline-flex items-center gap-2 bg-kcb-or hover:bg-kcb-bronze text-kcb-noir text-white px-8 py-3 rounded-[4px] transition font-medium"
          >
            Voir les plans premium
            <ArrowUp className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

export default Abonnement
