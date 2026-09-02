import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, ArrowLeft, Calendar, CreditCard } from 'lucide-react'
import { getMySubscription } from '../api/useSubscriptions'
import { DataLoader } from '../components/loaders/PageLoader'
import { toast } from 'sonner'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import { useAuthUser } from '../api/useAuthUser' /* ✨ React Query */

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams()
  const { data: user } = useAuthUser() /* ✨ React Query */
  const [state, setState] = useState({ subscription: null, plan: null, loading: true, error: null })

  useEffect(() => {
    const load = async () => {
      // Le webhook PayDunya active l'abonnement côté serveur.
      // On sonde jusqu'à 5× (toutes les 2s) le temps que le webhook soit traité.
      let sub = null
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 500 : 2000))
        sub = await getMySubscription()
        if (sub?.id) break
      }

      if (sub?.id) {
        const plan = sub.plan ?? sub.plans ?? null
        setState({ subscription: sub, plan, loading: false, error: null })
        toast.success('Abonnement activé avec succès !')
      } else {
        setState((prev) => ({
          ...prev,
          error:
            'Abonnement introuvable. Si vous venez de payer, patientez quelques secondes puis rechargez la page.',
          loading: false,
        }))
      }
    }
    load()
  }, [])

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kcb-noir-deep">
        <div className="text-center">
          <DataLoader />
          <p className="text-kcb-pierre mt-4">Vérification de votre abonnement...</p>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kcb-noir-deep px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Erreur d'activation</h1>
          <p className="text-kcb-pierre mb-6">{state.error}</p>
          <Link
            to="/global#pricing"
            className="inline-flex items-center gap-2 bg-kcb-or hover:bg-kcb-bronze text-kcb-noir px-6 py-3 rounded-[4px] font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux plans
          </Link>
        </div>
      </div>
    )
  }

  const fmt = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : '—')

  return (
    <div className="min-h-screen bg-kcb-noir-deep py-12 px-4">
      <RevealOnScroll>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Abonnement activé !</h1>
            <p className="text-kcb-pierre">
              Votre abonnement {state.plan?.name} a été activé avec succès
            </p>
          </div>

          <div className="bg-kcb-ardoise rounded-[4px] p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Détails de votre abonnement</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
                <span className="text-kcb-pierre">Plan</span>
                <span className="text-white font-medium">{state.plan?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
                <span className="text-kcb-pierre">Montant</span>
                <span className="text-white font-medium">
                  {state.subscription?.amount?.toLocaleString('fr-FR')}{' '}
                  {state.subscription?.currency}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
                <span className="text-kcb-pierre">Date de début</span>
                <span className="text-white font-medium">
                  {fmt(state.subscription?.start_date)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
                <span className="text-kcb-pierre">Date de fin</span>
                <span className="text-white font-medium">{fmt(state.subscription?.end_date)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-kcb-pierre">Prochain paiement</span>
                <span className="text-white font-medium">
                  {fmt(state.subscription?.next_payment_date)}
                </span>
              </div>
            </div>
          </div>

          {state.plan?.features && (
            <div className="bg-kcb-ardoise rounded-[4px] p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Fonctionnalités incluses</h3>
              <ul className="space-y-2">
                {state.plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-kcb-sable">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to={user?.role === 'buyer' ? '/account' : `/dashboard/${user?.role || 'buyer'}`}
              className="flex-1 flex items-center justify-center gap-2 bg-kcb-or hover:bg-kcb-bronze text-kcb-noir px-6 py-3 rounded-[4px] font-medium transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Accéder au tableau de bord
            </Link>
            <Link
              to="/global#pricing"
              className="flex-1 flex items-center justify-center gap-2 bg-kcb-ardoise hover:bg-white/[0.03] text-white px-6 py-3 rounded-[4px] font-medium transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Voir tous les plans
            </Link>
          </div>

          <div className="mt-8 bg-kcb-or/5 border border-kcb-or/20 rounded-[4px] p-4">
            <p className="text-kcb-or text-sm">
              <strong>Note :</strong> Vous recevrez un email de confirmation avec les détails de
              votre abonnement.
            </p>
          </div>
        </div>
      </RevealOnScroll>
    </div>
  )
}
