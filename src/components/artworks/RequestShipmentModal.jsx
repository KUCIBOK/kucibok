import { useState } from 'react'
import { X, Truck, Package, CheckCircle, Loader2 } from 'lucide-react'
import { useDelivery } from '../../store/DeliveryStore'

import { listCountries } from '../../../api/_modules/countries.js'

// Tous les pays du monde (ISO 3166-1), noms en français
const COUNTRIES = listCountries('fr')
const TRANSPORT_MODES = [
  { value: 'AIR', label: 'Aérien (recommandé)' },
  { value: 'SEA', label: 'Maritime' },
  { value: 'LAND', label: 'Routier' },
]
const TRANSPORT_TYPES = [
  { value: 'EXPRESS', label: 'Express (recommandé)' },
  { value: 'FRET', label: 'Fret' },
  { value: 'GROUPAGE', label: 'Groupage' },
]

const PACKAGING_ITEMS = [
  { key: 'museum_wrap', label: 'Emballage muséal (papier de soie + film)' },
  { key: 'bubble_wrap', label: "Protection bulles d'air" },
  { key: 'crate', label: 'Caisse en bois renforcée' },
  { key: 'fragile_label', label: 'Étiquettes « Fragile » et « Haut »' },
  { key: 'humidity_control', label: 'Contrôle humidité (silica gel)' },
]

const initialForm = {
  corridor: 'AF_TO_FR',
  originCountry: '',
  originCountryCode: '',
  destinationCountry: '',
  destinationCountryCode: '',
  transportMode: 'AIR',
  transportType: 'EXPRESS',
  senderPhone: '',
  senderAddress: '',
  recipientEmail: '',
  goodsValue: '',
  deliveryAddress: '',
  recipientName: '',
  recipientPhone: '',
  collectDate: '',
  deliveryDate: '',
  specialInstructions: '',
  packageSize: 'medium',
  packageWeight: '',
  deliveryPriority: 'standard',
  packagingChecklist: {
    museum_wrap: false,
    bubble_wrap: false,
    crate: false,
    fragile_label: false,
    humidity_control: false,
  },
}

export function RequestShipmentModal({ artwork, isOpen, onClose }) {
  const { create } = useDelivery()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null) // trackingId on success

  if (!isOpen) return null

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
  const setCountry = (field, code) => {
    const name = COUNTRIES.find((c) => c.code === code)?.name || ''
    setForm((prev) => ({ ...prev, [`${field}Code`]: code, [field]: name }))
  }
  const setChecklist = (key, value) =>
    setForm((prev) => ({
      ...prev,
      packagingChecklist: { ...prev.packagingChecklist, [key]: value },
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.originCountryCode || !form.destinationCountryCode || !form.deliveryAddress || !form.recipientName || !form.recipientPhone)
      return
    setLoading(true)
    const payload = {
      ...form,
      artworkIds: [artwork._id],
    }
    const result = await create(payload)
    setLoading(false)
    if (result?._id) {
      setSuccess(result.trackingId || result._id)
    }
  }

  const handleClose = () => {
    setForm(initialForm)
    setSuccess(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-kcb-ardoise border border-white/[0.06] rounded-[4px] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] sticky top-0 bg-kcb-ardoise z-10">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-kcb-or" />
            <h2 className="text-white font-semibold">Demande d'expédition transfrontalière</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-kcb-pierre hover:text-white transition p-1 rounded-[4px] hover:bg-kcb-ardoise"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Succès */}
        {success && (
          <div className="px-6 py-10 text-center">
            <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold text-xl mb-2">Demande envoyée !</h3>
            <p className="text-kcb-pierre text-sm mb-6">
              Votre demande d'expédition pour{' '}
              <strong className="text-white">{artwork.title}</strong> a été soumise. Elle reste
              en attente de validation par l'équipe Kucibok ; vous serez notifié avec le coût et le
              numéro de suivi dès la création de l'expédition.
            </p>
            {typeof success === 'string' && success.length > 10 && (
              <div className="bg-kcb-ardoise border border-kcb-or/30 rounded-[4px] p-4 mb-6">
                <p className="text-kcb-pierre text-xs mb-1">Numéro de suivi</p>
                <p className="text-kcb-or font-mono font-semibold text-lg">{success}</p>
              </div>
            )}
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-kcb-or hover:bg-kcb-or/90 text-kcb-noir text-sm font-semibold rounded-[4px] transition"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Formulaire */}
        {!success && (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Œuvre concernée */}
            <div className="bg-kcb-ardoise/60 border border-white/[0.06] rounded-[4px] p-3 flex items-center gap-3">
              {artwork.image && (
                <img
                  src={artwork.image}
                  alt={artwork.title}
                  className="w-12 h-12 object-cover rounded-[4px] shrink-0"
                />
              )}
              <div>
                <p className="text-white text-sm font-semibold">{artwork.title}</p>
                <p className="text-kcb-pierre text-xs">{artwork.artist}</p>
              </div>
            </div>

            {/* Corridor */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kcb-pierre font-medium">Direction</label>
              <select
                value={form.corridor}
                onChange={(e) => set('corridor', e.target.value)}
                className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
              >
                <option value="AF_TO_FR">Afrique → France</option>
                <option value="FR_TO_AF">France → Afrique</option>
              </select>
            </div>

            {/* Pays de départ et d'arrivée : tous les pays du monde */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['originCountry', 'Pays de départ'],
                ['destinationCountry', "Pays d'arrivée"],
              ].map(([field, label]) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-xs text-kcb-pierre font-medium">
                    {label} <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={form[`${field}Code`]}
                    onChange={(e) => setCountry(field, e.target.value)}
                    className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
                  >
                    <option value="">Sélectionner…</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Transport : aérien + express par défaut */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">Mode de transport</label>
                <select
                  value={form.transportMode}
                  onChange={(e) => set('transportMode', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
                >
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">Type d'envoi</label>
                <select
                  value={form.transportType}
                  onChange={(e) => set('transportType', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
                >
                  {TRANSPORT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Expéditeur */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">
                  Votre téléphone <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={form.senderPhone}
                  onChange={(e) => set('senderPhone', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-kcb-or"
                  placeholder="+221 77 000 00 00"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">
                  Adresse de collecte <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={form.senderAddress}
                  onChange={(e) => set('senderAddress', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-kcb-or"
                  placeholder="Almadies, Dakar"
                />
              </div>
            </div>

            {/* Destinataire */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">
                  Nom du destinataire <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={form.recipientName}
                  onChange={(e) => set('recipientName', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-kcb-or"
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">
                  Téléphone <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={form.recipientPhone}
                  onChange={(e) => set('recipientPhone', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-kcb-or"
                  placeholder="+33 6 00 00 00 00"
                />
              </div>
            </div>

            {/* Adresse de livraison */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kcb-pierre font-medium">
                Adresse de livraison <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={form.deliveryAddress}
                onChange={(e) => set('deliveryAddress', e.target.value)}
                className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-kcb-or"
                placeholder="12 rue de l'Art, 75001 Paris, France"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">Date de collecte</label>
                <input
                  type="date"
                  value={form.collectDate}
                  onChange={(e) => set('collectDate', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">Livraison souhaitée</label>
                <input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => set('deliveryDate', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
                />
              </div>
            </div>

            {/* Colis */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">Taille du colis</label>
                <select
                  value={form.packageSize}
                  onChange={(e) => set('packageSize', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
                >
                  <option value="small">Petit (&lt;50cm)</option>
                  <option value="medium">Moyen</option>
                  <option value="large">Grand</option>
                  <option value="extra_large">Très grand</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">Poids estimé (kg)</label>
                <input
                  type="number"
                  min="0.1"
                  max="500"
                  value={form.packageWeight}
                  onChange={(e) => set('packageWeight', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-kcb-or"
                  placeholder="ex: 5"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kcb-pierre font-medium">Priorité</label>
                <select
                  value={form.deliveryPriority}
                  onChange={(e) => set('deliveryPriority', e.target.value)}
                  className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcb-or"
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="priority">Prioritaire</option>
                </select>
              </div>
            </div>

            {/* Checklist emballage muséal */}
            <div className="border border-kcb-or/20 rounded-[4px] p-4 space-y-3 bg-kcb-or/5">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-kcb-or" />
                <p className="text-xs font-semibold text-kcb-or uppercase tracking-wider">
                  Protocole emballage muséal
                </p>
              </div>
              {PACKAGING_ITEMS.map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.packagingChecklist[item.key]}
                    onChange={(e) => setChecklist(item.key, e.target.checked)}
                    className="accent-kcb-or scale-110"
                  />
                  <span className="text-sm text-kcb-sable group-hover:text-white transition">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Instructions spéciales */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kcb-pierre font-medium">Instructions spéciales</label>
              <textarea
                value={form.specialInstructions}
                onChange={(e) => set('specialInstructions', e.target.value)}
                rows={3}
                className="rounded-[4px] bg-kcb-ardoise border border-white/[0.06] p-2 text-sm text-white placeholder-kcb-pierre focus:outline-none focus:ring-2 focus:ring-kcb-or resize-none"
                placeholder="ex: œuvre fragile, nécessite klimatisation, accès difficile…"
              />
            </div>

            {/* Note CITES */}
            <p className="text-xs text-kcb-pierre bg-kcb-ardoise/60 rounded-[4px] p-3">
              ℹ️ Si l'œuvre implique des matériaux protégés (ivoire, bois rare…), un certificat
              CITES sera demandé par les douanes. Kucibok vous accompagne dans cette démarche.
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-kcb-pierre hover:text-white border border-white/[0.06] rounded-[4px] hover:bg-kcb-ardoise transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-sm font-semibold bg-kcb-or hover:bg-kcb-or/90 text-kcb-noir rounded-[4px] transition flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Truck className="w-4 h-4" />
                )}
                Soumettre la demande
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
