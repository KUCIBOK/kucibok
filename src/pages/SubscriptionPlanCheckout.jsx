import { Link, useParams } from 'react-router-dom'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import { useAuth } from '../store/AuthContext'
import { useAuthUser } from '../api/useAuthUser' /* ✨ React Query */
import { useEffect, useState } from 'react'
import { getPlanById } from '../api/usePlans'
import { AlertCircle, ArrowLeft, Check, Lock, ShieldCheck, ShoppingCart } from 'lucide-react'
import { DataLoader } from '../components/loaders/PageLoader'
import { usePayment } from '../hooks/usePayment'
import PaymentMethodSelector from '../components/PaymentMethodSelector'
import { toast } from 'sonner'

/**
 * Taux de TVA selon la devise / région :
 *   XOF  — Afrique de l'Ouest CEDEAO  → 18 %
 *   EUR  — Union Européenne (particulier) → 20 %
 *   USD  — International                → 0 % (hors champ TVA)
 */
function getTvaRate(currency) {
  if (currency === 'XOF') return 0.18
  if (currency === 'EUR') return 0.2
  return 0 // USD et autres
}

export default function SubscriptionPlanCheckout() {
  const { id } = useParams()
  const { data: user } = useAuthUser() /* ✨ React Query */
  const { payForSubscription, loading: paymentLoading } = usePayment()
  const [state, setState] = useState({
    plan: {},
    loading: true,
    error: '',
    paymentMethod: 'paydunya',
  })

  const handlePaymentMethodChange = (method) => {
    setState((prev) => ({ ...prev, paymentMethod: method }))
  }

  const handlePayment = async () => {
    if (!user?.id) {
      toast.error('Vous devez être connecté pour souscrire à un abonnement')
      return
    }

    if (user?.role !== state?.plan?.role) {
      toast.error("Ce plan n'est pas compatible avec votre type de compte")
      return
    }

    try {
      if (state.paymentMethod === 'paydunya') {
        const result = await payForSubscription(id, { usePopup: false })
        if (!result.success) {
          toast.error(result.error || "Erreur lors de l'initialisation du paiement")
        }
      } else {
        toast.info('Méthode de paiement non encore disponible')
      }
    } catch (error) {
      toast.error('Erreur lors du traitement du paiement')
    }
  }
  useEffect(() => {
    window.scrollTo(0, 0)
    const fetchPlan = async () => {
      const plan = await getPlanById(id)
      if (plan?.id) {
        // Supabase NUMERIC retourne un string — normaliser en number
        plan.price = Number(plan.price ?? 0)
        plan.features = Array.isArray(plan.features) ? plan.features : []
        setState((prev) => ({ ...prev, plan, error: '', loading: false }))
      } else {
        setState((prev) => ({ ...prev, loading: false, error: plan?.error ?? 'Plan introuvable' }))
      }
    }
    fetchPlan()
  }, [])

  return (
    <>
      <div className="min-h-screen flex py-8 justify-center bg-kcb-noir-deep px-4">
        <div className="w-full max-w-4xl mx-auto px-4">
          <Link
            to={-1}
            className="flex items-center gap-2 text-kcb-pierre hover:text-white text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-5 h-5" /> Retour
          </Link>
          {state?.error && (
            <div className="bg-red-900/20 flex items-center text-red-200 font-medium py-2 rounded-[4px] mb-4 px-4">
              <AlertCircle className="w-4 h-4 mr-2" /> {state?.error}
            </div>
          )}
          {!state?.loading && state?.plan?.id ? (
            <RevealOnScroll>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 border border-white/[0.06] rounded-[4px] p-6 flex flex-col shadow-md">
                  <h2 className="font-playfair text-xl text-white font-semibold mb-6">
                    Résumé de votre abonnement
                  </h2>
                  <h2 className="font-playfair text-xl text-white font-semibold text-center">
                    {' '}
                    {state?.plan?.name}{' '}
                  </h2>
                  <p className="text-center">
                    <span className="text-xl text-white font-black mb-2">
                      {' '}
                      {(state?.plan?.price ?? 0).toLocaleString('fr-FR').replace(/\s/g, ' ')}{' '}
                      {state?.plan?.currency}
                    </span>
                    <span className="text-sm font-normal">/mois</span>
                  </p>
                  <h2 className="font-playfair text-lg text-white mb-2"> {state?.plan?.name} </h2>
                  <ul className="list-none pb-4 border-b border-white/[0.06]">
                    {state?.plan?.features?.map((item, idx) => (
                      <li key={idx} className="py-2 text-sm  text-white flex items-center gap-2">
                        {' '}
                        <Check className="text-green-500 w-4 h-4" /> {item}{' '}
                      </li>
                    ))}
                  </ul>
                  {(() => {
                    const price = state?.plan?.price ?? 0
                    const tvaRate = getTvaRate(state?.plan?.currency)
                    const ht = tvaRate > 0 ? price / (1 + tvaRate) : price
                    const tvaAmount = price - ht
                    const fmt = (n) => n.toLocaleString('fr-FR').replace(/\s/g, ' ')
                    const cur = (
                      <span className="text-xs font-normal text-kcb-pierre">
                        {state?.plan?.currency}
                      </span>
                    )
                    return (
                      <table className="w-full">
                        <tr>
                          <td>Abonnement {state?.plan?.name}</td>
                          <td className="text-end">
                            {fmt(ht)} {cur}
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {tvaRate > 0
                              ? `TVA (${(tvaRate * 100).toFixed(0)}%)`
                              : 'TVA (0% — hors champ)'}
                          </td>
                          <td className="text-end">
                            {fmt(tvaAmount)} {cur}
                          </td>
                        </tr>
                        <tr>
                          <td>Total mensuel</td>
                          <td className="text-end">
                            {fmt(price)} {cur}
                          </td>
                        </tr>
                      </table>
                    )
                  })()}
                  <ul className="rounded-[4px] p-2 bg-kcb-ardoise mt-4 list-disc ps-8">
                    <li>Annulation possible à tout moment</li>
                    <li>Première facture aujourd'hui</li>
                  </ul>
                </div>

                <div className="w-full md:w-96 border border-white/[0.06] rounded-[4px] p-6 flex flex-col gap-6 shadow-md">
                  <h3 className="flex items-center gap-2 text-white text-base font-semibold mb-2">
                    <ShieldCheck /> Paiement sécurisé
                  </h3>

                  {user?.id && user?.role === state?.plan?.role && (
                    <PaymentMethodSelector
                      selectedMethod={state.paymentMethod}
                      onMethodChange={handlePaymentMethodChange}
                      availableMethods={['paydunya']}
                    />
                  )}

                  <button
                    disabled={!user?.id || user?.role !== state?.plan?.role || paymentLoading}
                    onClick={handlePayment}
                    className="rounded-[4px] flex justify-center items-center gap-2 w-full bg-kcb-or hover:bg-kcb-bronze transition shadow py-2 text-kcb-noir font-semibold text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {!user?.id ? (
                      <Lock className="w-6 h-6 my-2" />
                    ) : user?.role !== state?.plan?.role ? (
                      <Lock className="w-6 h-6 my-2" />
                    ) : paymentLoading ? (
                      <DataLoader />
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Payer {(state?.plan?.price ?? 0).toLocaleString('fr-FR').replace(/\s/g, ' ')}{' '}
                        {state?.plan?.currency}
                      </>
                    )}
                  </button>

                  {!user?.id && (
                    <p className="flex items-center text-xs text-kcb-pierre mt-2">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Vous devez être inscrit pour souscrire à un abonnement
                    </p>
                  )}

                  {user?.id && user?.role !== state?.plan?.role && (
                    <p className="flex items-center text-xs text-kcb-pierre mt-2">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Ce plan n'est pas compatible avec votre type de compte
                    </p>
                  )}

                  {state.paymentMethod === 'paydunya' && (
                    <div className="text-xs text-kcb-pierre bg-kcb-ardoise p-3 rounded-[4px]">
                      <p className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                        Paiement sécurisé avec PayDunya
                      </p>
                      <p>Accepte Mobile Money, cartes bancaires et virements</p>
                    </div>
                  )}
                </div>
              </div>
            </RevealOnScroll>
          ) : (
            <div className="flex items-center justify-center min-h-[300px]">
              <DataLoader />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
