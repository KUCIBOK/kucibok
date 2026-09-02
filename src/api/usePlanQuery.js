/**
 * src/api/usePlanQuery.js - React Query hook for subscription plans
 * Replaces PlanContext
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../store/ToastContext'
import { createPlan, deletePlan, getAllPlans, updatePlan } from './usePlans'

async function fetchPlans() {
  const plans = await getAllPlans()
  return plans || []
}

export function usePlanStore() {
  const queryClient = useQueryClient()
  const { makeToast } = useToast()

  const query = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 120,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const addPlanMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: (newPlan) => {
      if (newPlan?.id || newPlan?._id) {
        queryClient.setQueryData(['plans'], (old) => [newPlan, ...(old || [])])
        makeToast('Succès', 'success', 'Le plan a été ajouté avec succès')
      }
    },
    onError: () => {
      makeToast('Erreur', 'danger', "Impossible d'ajouter le plan")
    },
  })

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePlan(id, payload),
    onSuccess: (plan) => {
      if (plan?.id || plan?._id) {
        queryClient.setQueryData(['plans'], (old) =>
          (old || []).map((p) => (p.id === plan.id || p._id === plan._id) ? plan : p)
        )
        makeToast('Succès', 'success', 'Le plan a été mis à jour avec succès')
      }
    },
    onError: () => {
      makeToast('Erreur', 'danger', 'Impossible de mettre à jour le plan')
    },
  })

  const deletePlanMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: (plan) => {
      if (plan?.id || plan?._id) {
        const id = plan?.id || plan?._id
        queryClient.setQueryData(['plans'], (old) =>
          (old || []).filter((p) => p.id !== id && p._id !== id)
        )
        makeToast('Succès', 'success', 'Le plan a été supprimé avec succès')
      }
    },
    onError: () => {
      makeToast('Erreur', 'danger', 'Impossible de supprimer le plan')
    },
  })

  const plans = query.data || []
  const buyerPlans = plans.filter((plan) => plan.role === 'buyer')
  const curatorPlans = plans.filter((plan) => plan.role === 'curator')

  return {
    plans,
    buyerPlans,
    curatorPlans,
    loading: query.isLoading,
    addPlan: (plan) => addPlanMutation.mutateAsync(plan),
    updatePlan: (id, payload) => updatePlanMutation.mutateAsync({ id, payload }),
    deletePlan: (id) => deletePlanMutation.mutateAsync(id),
    refresh: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
  }
}
