import { useState } from 'react'
import { useDelivery } from '../../store/DeliveryStore'
import { Check } from 'lucide-react'
import { Modal, Button, toast } from '../ui'

export function ValidateAction({ delivery }) {
  const [modal, setModal] = useState(false)
  // Déjà transmise à Logidoo : plus rien à valider
  if (delivery?.logidoo_expedition_id) return null
  return (
    <>
      <button
        aria-label="Valider et créer l'expédition chez Logidoo"
        title="Valider et créer l'expédition chez Logidoo"
        onClick={() => setModal(true)}
        className="text-green-500 hover:text-green-700 p-2 rounded-[4px] bg-green-600 hover:bg-green-700 shadow-sm transition-colors"
      >
        <Check className="w-4 h-4 text-white" />
      </button>
      {modal && <ValidateModal delivery={delivery} closeModal={() => setModal(false)} />}
    </>
  )
}

function ValidateModal({ delivery, closeModal }) {
  const { validate } = useDelivery()
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState(null)

  const handleValidation = async () => {
    setLoading(true)
    setProblem(null)
    const result = await validate(delivery._id)
    setLoading(false)
    if (result?._id) {
      const cost = result.price ? ` — coût : ${result.price} ${result.currency || 'XOF'}` : ''
      toast.success(`✓ Expédition créée chez Logidoo (suivi ${result.logidoo_tracking_number})${cost}`)
      closeModal()
    } else {
      setProblem(result?.error || 'Erreur lors de la validation')
    }
  }

  return (
    <Modal isOpen={true} onClose={closeModal} title="Valider et créer l'expédition" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-kcb-sable">
          L'expédition <strong className="text-white">{delivery.trackingId}</strong> sera créée chez
          Logidoo ({delivery.transport_mode || 'AIR'} / {delivery.transport_type || 'EXPRESS'}). Le coût
          et le numéro de suivi seront enregistrés et le demandeur sera prévenu. Cette action crée une
          vraie expédition : elle ne peut être annulée que depuis la demande.
        </p>
        {problem && (
          <p role="alert" className="text-sm text-red-400">
            {problem}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={closeModal} disabled={loading}>
            Annuler
          </Button>
          <Button type="button" onClick={handleValidation} disabled={loading} loading={loading}>
            Valider et créer chez Logidoo
          </Button>
        </div>
      </div>
    </Modal>
  )
}
