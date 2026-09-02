import { createContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createPlan, deletePlan, getAllPlans, updatePlan } from '../api/usePlans'
import { useContext } from 'react'
import { createLog } from '../api/useLog'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const initialState = {
  plans: [],
  buyerPlans: [],
  curatorPlans: [],
  loading: true,
}

const PlanContext = createContext(initialState)

export function PlanProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(initialState)
  const { makeToast } = useToast()
  useEffect(() => {
    // Fetch plans from an API or other source
    const fetchPlans = async () => {
      try {
        const plans = await getAllPlans()
        if (plans?.length > 0) {
          setState((prev) => ({
            ...prev,
            plans: plans,
            buyerPlans: plans.filter((plan) => plan.role === 'buyer'),
            curatorPlans: plans.filter((plan) => plan.role === 'curator'),
          }))
        }
      } catch (error) {
        makeToast('Erreur', 'danger', 'Impossible de charger les plans')
      }
    }

    fetchPlans().finally(() => {
      setState((prev) => ({ ...prev, loading: false }))
    })
  }, [makeToast, user?.id])

  const addPlan = useCallback(async (plan) => {
    try {
      const newPlan = await createPlan(plan)
      if (newPlan?.id) {
        setState((prev) => ({
          ...prev,
          plans: [newPlan, ...prev.plans],
          buyerPlans:
            newPlan.role === 'buyer' ? [newPlan, ...prev.buyerPlans] : prev.buyerPlans,
          curatorPlans:
            newPlan.role === 'curator' ? [newPlan, ...prev.curatorPlans] : prev.curatorPlans,
        }))
        makeToast('Succès', 'success', 'Le plan a été ajouté avec succès')
        await createLog({
          description: `Le plan ${plan?.name} a été ajouté`,
          userId: user?.id,
        })
        return newPlan
      }
    } catch (error) {
      makeToast('Erreur', 'danger', "Impossible d'ajouter le plan")
      return { error: error.message }
    }
  }, [makeToast, user?.id, createLog])

  const updatePlanCtx = useCallback(async (id, payload) => {
    try {
      const plan = await updatePlan(id, payload)
      if (plan?.id) {
        setState((prev) => ({
          ...prev,
          plans: prev.plans.map((p) => (p.id === id ? plan : p)),
          buyerPlans:
            plan?.role === 'buyer'
              ? [plan, ...prev.buyerPlans.filter((item) => item?.id != plan?.id)]
              : prev.buyerPlans,
          curatorPlans:
            plan?.role === 'curator'
              ? [plan, ...prev.curatorPlans.filter((item) => item?.id != plan?.id)]
              : prev.curatorPlans,
        }))
        makeToast('Succès', 'success', 'Le plan a été mis à jour avec succès')
        await createLog({
          description: `Le plan ${plan?.name} a été modifié`,
          userId: user?.id,
        })
        return plan
      }
    } catch (error) {
      makeToast('Erreur', 'danger', 'Impossible de mettre à jour le plan')
      return { error: error.message }
    }
  }, [makeToast, user?.id, createLog])

  const deletePlanCtx = useCallback(async (id) => {
    try {
      const plan = await deletePlan(id)
      if (plan?.id) {
        setState((prev) => ({
          ...prev,
          plans: prev.plans.filter((p) => p.id != id),
          buyerPlans: prev.buyerPlans.filter((item) => item?.id != id),
          curatorPlans: prev.curatorPlans.filter((item) => item?.id != id),
        }))
        makeToast('Succès', 'success', 'Le plan a été supprimé avec succès')
        await createLog({
          description: `Le plan ${plan?.name} a été supprimé`,
          userId: user?.id,
        })
        return plan
      }
    } catch (error) {
      makeToast('Erreur', 'danger', 'Impossible de supprimer le plan')
      return { error: error.message }
    }
  }, [makeToast, user?.id, createLog])

  const value = useMemo(() => ({
    plans: state.plans,
    buyerPlans: state?.buyerPlans,
    curatorPlans: state?.curatorPlans,
    loading: state.loading,
    addPlan,
    updatePlan: updatePlanCtx,
    deletePlan: deletePlanCtx,
  }), [state, addPlan, updatePlanCtx, deletePlanCtx])

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlanStore() {
  return useContext(PlanContext)
}
