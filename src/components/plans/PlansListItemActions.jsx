import { AlertCircle, PenBoxIcon, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import { usePlanStore } from '../../api/usePlanQuery'
import { DataLoader } from '../loaders/PageLoader'
import { ConfirmDialog, toast, Modal, Input, Select, Button } from '../ui'
import { Link } from 'react-router-dom'

export function PlansListItemActions({ plan }) {
  const { user } = useAuth()
  const { deletePlan } = usePlanStore()
  const [state, setState] = useState({
    updatePlan: false,
    confirmDelete: false,
    loading: false,
    error: '',
  })
  const handleDeletePlan = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, confirmDelete: false }))
      const deletedPlan = await deletePlan(plan?._id)
      if (deletedPlan?._id) {
        setState((prev) => ({ ...prev, loading: false }))
      } else {
        setState((prev) => ({ ...prev, loading: false }))
      }
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }
  return (
    <>
      <div className="flex gap-2 items-center w-full mx-auto mx-auto justify-center p-4">
        {user?.role === 'admin' ? (
          <>
            <button
              onClick={() => setState((prev) => ({ ...prev, updatePlan: true }))}
              className="justify-center w-8/10 border rounded-[4px] bg-kcb-noir text-white font-medium py-2 px-2 md:py-2.5 md:px-4 flex items-center hover:bg-kcb-ardoise transition-colors duration-200"
            >
              <PenBoxIcon className="w-4 h-4 mr-2 text-white" /> Modifier
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, confirmDelete: true }))}
              className=" justify-center w-2/10 border rounded-[4px] bg-red-900/90 text-white font-medium py-2 px-2 md:py-2.5 md:px-4 flex items-center hover:bg-red-700/90 transition-colors duration-200"
            >
              {state.loading ? <DataLoader /> : <Trash2 className=" text-white w-4 h-4" />}
            </button>
          </>
        ) : (
          plan?.price > 0 && (
            <Link
              to={`/subscription-checkout/${plan?._id}`}
              className="justify-center w-full border rounded-[4px] bg-kcb-noir text-white font-medium py-2 px-2 md:py-2.5 md:px-4 flex items-center hover:bg-kcb-ardoise transition-colors duration-200"
            >
              Souscrire
            </Link>
          )
        )}
      </div>
      {state?.updatePlan && (
        <UpdatePlanModal
          plan={plan}
          closeModal={() => setState((prev) => ({ ...prev, updatePlan: false }))}
        />
      )}
      <ConfirmDialog
        isOpen={state.confirmDelete}
        onClose={() => setState((prev) => ({ ...prev, confirmDelete: false }))}
        onConfirm={handleDeletePlan}
        title="Supprimer le plan"
        message={`Supprimer définitivement le plan "${plan?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
        loading={state.loading}
      />
    </>
  )
}

function UpdatePlanModal({ closeModal, plan }) {
  const { updatePlan } = usePlanStore()
  const [state, setState] = useState({
    ...plan,
    feature: '',
    loading: false,
  })

  const currencyOptions = [
    { value: 'XOF', label: 'XOF' },
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
  ]

  const durationOptions = [
    { value: 'monthly', label: 'Mensuel' },
    { value: 'yearly', label: 'Annuel' },
  ]

  const roleOptions = [
    { value: 'buyer', label: 'Acheteur' },
    { value: 'curator', label: 'Curateur' },
  ]

  const handleUpdatePlan = async (e) => {
    e.preventDefault()
    try {
      if (state.features.length === 0) {
        toast.error('× Ajoutez au moins une fonctionnalité')
        return
      }
      setState({ ...state, loading: true })
      const charge = { ...state }
      delete charge.feature
      delete charge.loading
      const updated = await updatePlan(plan?._id, charge)
      if (updated?._id) {
        toast.success('✓ Plan mis à jour')
        closeModal()
      } else {
        toast.error('× ' + (updated?.error || 'Erreur'))
      }
      setState({ ...state, loading: false })
    } catch (error) {
      toast.error('× Erreur serveur')
      setState({ ...state, loading: false })
    }
  }
  return (
    <Modal isOpen={true} onClose={closeModal} title="Modifier le plan" size="md">
      <form onSubmit={handleUpdatePlan} method="post" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nom du plan"
            value={state?.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="Nom du plan"
            minLength={3}
            required
          />
          <Input
            label="Prix"
            type="number"
            min={0}
            max={65590}
            value={state?.price}
            onChange={(e) => setState({ ...state, price: e.target.value })}
            placeholder="Prix"
            required
          />
        </div>

        <Input
          label="Description"
          value={state?.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
          placeholder="Description du plan"
          minLength={5}
          required
        />

        <div className="grid grid-cols-3 gap-2">
          <Select
            label="Devise"
            options={currencyOptions}
            value={state?.currency}
            onChange={(value) => setState({ ...state, currency: value })}
          />
          <Select
            label="Durée"
            options={durationOptions}
            value={state?.duration}
            onChange={(value) => setState({ ...state, duration: value })}
          />
          <Select
            label="Rôle"
            options={roleOptions}
            value={state?.role}
            onChange={(value) => setState({ ...state, role: value })}
          />
        </div>

        {/* Features */}
        <div>
          <label className="block text-sm font-medium text-kcb-sable mb-2">Fonctionnalités</label>
          <div className="flex gap-2">
            <Input
              value={state?.feature}
              onChange={(e) => setState({ ...state, feature: e.target.value })}
              placeholder="Ajouter une fonctionnalité"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => {
                if (state?.feature) {
                  setState({
                    ...state,
                    features: [...(state?.features || []), state?.feature],
                    feature: '',
                  })
                }
              }}
              disabled={!state?.feature}
            >
              +
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {state?.features?.length > 0 &&
              state?.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-kcb-or/80 rounded-full px-3 py-1 text-xs"
                >
                  <span className="text-white">{feature}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setState({
                        ...state,
                        features: state?.features.filter((f, i) => i !== index),
                      })
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={closeModal}>
            Annuler
          </Button>
          <Button type="submit" disabled={state.loading} loading={state.loading}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
