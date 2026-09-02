import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RevealOnScroll from '../components/landing/RevealOnScroll'
import { getArtistById } from '../api/useArtists'
import { getArtworkById } from '../api/useArtworks'
import { AlertCircle, ArrowLeft, Lock, ShoppingCart, User } from 'lucide-react'
import { useAuth } from '../store/AuthContext'
import { useAuthUser } from '../api/useAuthUser' /* ✨ React Query */
import { DataLoader } from '../components/loaders/PageLoader'
import { usePayment } from '../hooks/usePayment'
import PaymentMethodSelector from '../components/PaymentMethodSelector'
import { toast } from 'sonner'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ArtworkCheckout() {
  const { id } = useParams()
  const { data: user } = useAuthUser() /* ✨ React Query */
  const { payForArtwork, loading: paymentLoading } = usePayment()

  const [artwork, setArtwork] = useState({
    artist: null,
    loading: true,
    error: '',
  })

  const [paymentMethod, setPaymentMethod] = useState('paydunya')

  // Champs invité, utilisés uniquement si pas de session.
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
    const fetchArtwork = async () => {
      try {
        const data = await getArtworkById(id)
        if (data?.id) {
          if (data.sold) {
            setArtwork((prev) => ({
              ...prev,
              loading: false,
              error: 'Cette œuvre a déjà été vendue.',
            }))
            return
          }
          const artistData = data?.artist_id ? await getArtistById(data.artist_id) : null
          setArtwork({ ...data, artist: artistData?.id ? artistData : null, loading: false })
          return
        }
        setArtwork((prev) => ({
          ...prev,
          loading: false,
          error: data?.error || 'Œuvre introuvable',
        }))
        toast.error(data?.error || "Erreur lors du chargement de l'œuvre")
      } catch {
        setArtwork((prev) => ({ ...prev, loading: false, error: 'Erreur de connexion' }))
        toast.error('Erreur de connexion')
      }
    }
    fetchArtwork()
  }, [id])

  const handlePayment = async () => {
    if (!artwork?.id) {
      toast.error('Œuvre introuvable')
      return
    }

    if (!artwork?.price || artwork.price <= 0) {
      toast.error("Prix invalide, impossible de finaliser l'achat")
      return
    }

    if (artwork?.sold) {
      toast.error('Cette œuvre a déjà été vendue')
      return
    }

    // Construit l'objet guest si pas de session. Le backend exige nom +
    // email pour pouvoir livrer l'œuvre et envoyer le reçu.
    let guest = null
    if (!user?.id) {
      const name = guestName.trim()
      const email = guestEmail.trim()
      if (!name || !email) {
        toast.error('Renseignez votre nom et votre email pour acheter sans compte')
        return
      }
      if (!EMAIL_RE.test(email)) {
        toast.error('Email invalide')
        return
      }
      guest = { name, email, phone: guestPhone.trim() || null }
    }

    const artworkRef = artwork._id ?? artwork.id

    try {
      if (paymentMethod === 'paydunya') {
        await payForArtwork(artworkRef, {}, guest)
      } else {
        toast.info('Méthode de paiement non encore disponible')
      }
    } catch {
      toast.error('Erreur lors du paiement')
    }
  }

  return (
    <>
      <div className="min-h-screen flex py-8 justify-center bg-kcb-noir-deep px-2">
        <div className="w-full max-w-3xl mx-auto">
          <Link
            to={-1}
            className="flex items-center gap-2 text-kcb-pierre hover:text-white text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-5 h-5" /> Retour
          </Link>
          {artwork?.error && (
            <div className="bg-red-900/20 flex items-center text-red-200 font-medium py-2 rounded-[4px] mb-4 px-4">
              <AlertCircle className="w-4 h-4 mr-2" /> {artwork?.error}
            </div>
          )}
          {!artwork?.loading ? (
            <RevealOnScroll>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Résumé */}
                <div className="flex-1 bg-kcb-noir-deep border border-white/[0.06] rounded-[4px] p-4 md:p-6 flex flex-col gap-4 md:gap-6 shadow-md">
                  <h2 className="font-playfair text-xl text-white font-semibold mb-2">
                    Résumé de la commande
                  </h2>
                  <div className="flex gap-4 items-center">
                    <img
                      src={artwork?.image || '/images/placeholder-artwork.svg'}
                      alt={artwork?.title}
                      className="rounded-[4px] w-24 h-24 object-cover border border-white/[0.06]"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-white text-lg">{artwork?.title}</span>
                      {artwork?.edition && (
                        <span className="text-xs text-kcb-pierre">
                          Édition #{artwork?.edition?.number}/{artwork?.edition?.total}
                        </span>
                      )}
                      <span className="text-kcb-or font-bold text-lg">
                        {artwork?.price?.toLocaleString('fr-FR').replace(/\s/g, ' ')}{' '}
                        {artwork?.currency}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-white/[0.06] pt-4 mt-2 text-white text-base space-y-2">
                    <div className="flex justify-between">
                      <span>Prix</span>
                      <span>
                        {artwork?.price?.toLocaleString('fr-FR').replace(/\s/g, ' ')}{' '}
                        {artwork?.currency}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>
                        {artwork?.price?.toLocaleString('fr-FR').replace(/\s/g, ' ')}{' '}
                        {artwork?.currency}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Paiement */}
                <div className="w-full md:w-80 lg:w-96 bg-kcb-noir-deep border border-white/[0.06] rounded-[4px] p-4 md:p-6 flex flex-col gap-4 md:gap-6 shadow-md">
                  <h3 className="flex items-center gap-2 text-white text-base font-semibold mb-2">
                    <Lock className="w-4 h-4" /> Paiement sécurisé
                  </h3>

                  {/* Sélecteur de méthode de paiement */}
                  <PaymentMethodSelector
                    selectedMethod={paymentMethod}
                    onMethodChange={setPaymentMethod}
                    showTitle={false}
                  />

                  {!user?.id && (
                    <div className="border-t border-white/[0.06] pt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <User className="w-4 h-4 text-kcb-or" />
                        <span className="font-medium">Acheter sans compte</span>
                      </div>
                      <p className="text-xs text-kcb-pierre">
                        Pour la livraison et le reçu. Vous pouvez aussi{' '}
                        <Link to="/sign-in" className="text-kcb-or hover:underline">
                          vous connecter
                        </Link>
                        .
                      </p>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Nom complet"
                        autoComplete="name"
                        className="w-full bg-kcb-noir border border-white/[0.06] rounded-[4px] px-3 py-2 text-sm text-white placeholder:text-kcb-pierre/70 focus:border-kcb-or focus:outline-none"
                      />
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="Email"
                        autoComplete="email"
                        className="w-full bg-kcb-noir border border-white/[0.06] rounded-[4px] px-3 py-2 text-sm text-white placeholder:text-kcb-pierre/70 focus:border-kcb-or focus:outline-none"
                      />
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="Téléphone (optionnel)"
                        autoComplete="tel"
                        className="w-full bg-kcb-noir border border-white/[0.06] rounded-[4px] px-3 py-2 text-sm text-white placeholder:text-kcb-pierre/70 focus:border-kcb-or focus:outline-none"
                      />
                    </div>
                  )}

                  <button
                    disabled={paymentLoading || artwork?.loading}
                    onClick={handlePayment}
                    className="rounded-[4px] flex justify-center items-center gap-2 w-full bg-kcb-or hover:bg-kcb-bronze transition shadow py-2 text-kcb-noir font-semibold text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {paymentLoading || artwork?.loading ? (
                      <DataLoader />
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Payer {artwork?.price?.toLocaleString('fr-FR').replace(/\s/g, ' ')}{' '}
                        {artwork?.currency}
                      </>
                    )}
                  </button>

                  {/* Informations de sécurité */}
                  <div className="text-xs text-kcb-pierre border-t border-white/[0.06] pt-4">
                    <p className="flex items-center gap-1 mb-1">
                      <Lock className="w-3 h-3" />
                      Paiement 100% sécurisé
                    </p>
                    <p>Vos données sont protégées par un cryptage SSL</p>
                    <p className="mt-1 text-kcb-pierre">
                      Powered by PayDunya - Service de paiement agréé
                    </p>
                  </div>
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
