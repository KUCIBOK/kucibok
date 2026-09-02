import { useState, useEffect } from 'react'
import {
  CreditCard,
  Check,
  Zap,
  Crown,
  Shield,
  ShoppingBag,
  Package,
  Clock,
  ArrowUp,
  AlertTriangle,
  Heart,
  Eye,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useCollectorView } from '../../api/useCollectorArtworksQuery' /* ✨ React Query */
import { Progress, KPICard, Badge, Button } from '../ui'

// Plan features limits for collectors
const PLAN_LIMITS = {
  free: {
    name: 'Gratuit',
    price: 0,
    maxFavorites: 20,
    maxCollectionViews: 100,
    features: [
      '20 favoris maximum',
      '100 vues de collection',
      'Notifications basiques',
      'Support par email',
    ],
  },
  enthusiast: {
    name: 'Enthousiaste',
    price: 4900,
    maxFavorites: 100,
    maxCollectionViews: 1000,
    features: [
      '100 favoris',
      '1000 vues de collection',
      'Notifications avancées',
      'Alertes prix',
      'Historique complet',
    ],
  },
  buyer: {
    name: 'Acheteur',
    price: 9900,
    maxFavorites: 500,
    maxCollectionViews: 5000,
    features: [
      'Favoris illimités',
      'Vues illimitées',
      'Notifications en temps réel',
      'Accès aux ventes privées',
      "Estimation d'oeuvres",
      'conseiller dédié',
    ],
  },
  investor: {
    name: 'Investisseur',
    price: 19900,
    maxFavorites: -1,
    maxCollectionViews: -1,
    features: [
      'Tout illimité',
      'Ventes exclusives',
      'Analytique portfolio',
      'Rapports mensuels',
      'Conseiller VIP',
      'Formation art',
    ],
  },
}

function getPlanKey(planName) {
  if (!planName) return 'free'
  const name = planName.toLowerCase()
  if (name.includes('gratuit') || name === 'free') return 'free'
  if (name.includes('enthusiast') || name.includes('enthousiaste')) return 'enthusiast'
  if (name.includes('collector') || name.includes('collectionneur')) return 'collector'
  if (name.includes('investor') || name.includes('investisseur')) return 'investor'
  return 'free'
}

export function CollectorAbonnement() {
  const { subscription } = useAuth()
  const { buyed, favorites } = useCollectorView() /* ✨ React Query */
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  const planKey = getPlanKey(subscription?.plan?.name)
  const currentPlan = PLAN_LIMITS[planKey] || PLAN_LIMITS.free

  // Calculate collector-specific usage
  const favoritesCount = favorites?.length || 0
  const collectionViewsCount = Math.round(favoritesCount * 15) // Estimate
  const purchasesCount = buyed?.length || 0

  // Calculate percentages
  const favoritesPercent =
    currentPlan.maxFavorites > 0
      ? Math.min((favoritesCount / currentPlan.maxFavorites) * 100, 100)
      : 0
  const viewsPercent =
    currentPlan.maxCollectionViews > 0
      ? Math.min((collectionViewsCount / currentPlan.maxCollectionViews) * 100, 100)
      : 0

  const needsUpgrade = favoritesPercent >= 80 || viewsPercent >= 80
  const isAtLimit = favoritesPercent >= 100 || viewsPercent >= 100

  const getRecommendedUpgrade = () => {
    if (planKey === 'free') return 'enthusiast'
    if (planKey === 'enthusiast') return 'collector'
    if (planKey === 'collector') return 'investor'
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Mon Abonnement</h1>
          <p className="text-kcb-pierre">Gérez votre plan et votre expérience de collectionneur</p>
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
          {subscription?.currentPeriodEnd && (
            <div className="text-right">
              <p className="text-sm text-kcb-pierre">Prochaine facturation</p>
              <p className="text-white font-medium">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR')}
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

      {/* Collector Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Favorites Usage */}
        <div className="bg-kcb-ardoise rounded-[4px] p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              <h3 className="font-semibold text-white">Favoris</h3>
            </div>
            <Badge variant={favoritesPercent >= 80 ? 'danger' : 'success'}>
              {favoritesPercent.toFixed(0)}%
            </Badge>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-kcb-pierre">Utilisation</span>
              <span className="text-white font-medium">
                {favoritesCount} /{' '}
                {currentPlan.maxFavorites === -1 ? '∞' : currentPlan.maxFavorites}
              </span>
            </div>
            <Progress
              value={favoritesCount}
              max={currentPlan.maxFavorites === -1 ? 100 : currentPlan.maxFavorites}
              variant={favoritesPercent >= 80 ? 'danger' : 'primary'}
              size="md"
            />
          </div>
        </div>

        {/* Collection Views */}
        <div className="bg-kcb-ardoise rounded-[4px] p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-kcb-or" />
              <h3 className="font-semibold text-white">Vues Collection</h3>
            </div>
            <Badge variant={viewsPercent >= 80 ? 'danger' : 'success'}>
              {viewsPercent.toFixed(0)}%
            </Badge>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-kcb-pierre">Utilisation</span>
              <span className="text-white font-medium">
                {collectionViewsCount} /{' '}
                {currentPlan.maxCollectionViews === -1 ? '∞' : currentPlan.maxCollectionViews}
              </span>
            </div>
            <Progress
              value={collectionViewsCount}
              max={currentPlan.maxCollectionViews === -1 ? 100 : currentPlan.maxCollectionViews}
              variant={viewsPercent >= 80 ? 'danger' : 'info'}
              size="md"
            />
          </div>
        </div>

        {/* Purchases */}
        <KPICard
          icon={ShoppingBag}
          label="Achats effectués"
          value={purchasesCount}
          subtitle="oeuvres acquises"
          iconColor="text-green-400"
          iconBgColor="bg-green-900/20"
        />
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

      {/* Subscription History */}
      {subscription && (
        <div className="bg-kcb-ardoise rounded-[4px] p-6 border border-white/[0.06]">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-kcb-or" />
            Historique
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
              <div>
                <p className="text-white">Abonnement started</p>
                <p className="text-sm text-kcb-pierre">
                  {new Date(subscription.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <span className="px-3 py-1 bg-green-700 text-white text-sm rounded-full">Actif</span>
            </div>
            {currentSpent > 0 && (
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="text-white">Total dépensé</p>
                  <p className="text-sm text-kcb-pierre">{monthsSubscribed} mois d'abonnement</p>
                </div>
                <span className="text-xl font-bold text-white">
                  {currentSpent.toLocaleString()} CFA
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade CTA for Free users */}
      {!subscription && (
        <div className="bg-kcb-ardoise rounded-[4px] p-6 border border-white/[0.06] text-center">
          <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            Débloquez votre potentiel de collectionneur
          </h3>
          <p className="text-kcb-pierre mb-6 max-w-lg mx-auto">
            Avec un abonnement premium, accédez à plus de favoris, des ventes privées et des outils
            d'analyse de votre collection.
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

export default CollectorAbonnement
