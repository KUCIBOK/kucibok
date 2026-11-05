import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import {
  getMyDeliveries,
  getDeliveries,
  createDelivery,
  updateDelivery,
  changeDeliveryStatus,
  validateDelivery,
  deleteDelivery,
} from '../api/useDelivery'

const initialState = {
  deliveries: [],
  myDeliveries: [],
  loading: true,
}
export function DeliveryContextProvider({ children }) {
  const [state, setState] = useState(initialState)
  const { makeToast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const deliveries = user?.role === 'admin' ? await getDeliveries() : await getMyDeliveries()
        if (deliveries?.length > 0) {
          const sorted = [...deliveries].reverse()
          setState((prev) => ({
            ...prev,
            deliveries: sorted,
            myDeliveries: sorted,
          }))
          return
        }
      } catch (error) {
        makeToast('Error fetching deliveries', 'error')
      }
    }
    if (user?.role) {
      fetchDeliveries().finally(() => {
        setState((prev) => ({ ...prev, loading: false }))
      })
    } else {
      setState((prev) => ({ ...prev, loading: false }))  
    }
  }, [user?.role, makeToast])

  const create = useCallback(async (payload) => {
    try {
      const delivery = await createDelivery(payload)
      if (delivery?._id) {
        setState((prev) => ({
          ...prev,
          deliveries: [delivery, ...prev.deliveries],
          myDeliveries: [delivery, ...prev.myDeliveries],
        }))
        makeToast('Requête créée avec succès', 'success')
        return delivery
      }
      makeToast(delivery?.error || 'Échec de la création de la livraison', 'error')
    } catch (error) {
      makeToast(error.message, 'error')
    }
  }, [makeToast])

  const updateDeliveryCtx = useCallback(async (id, payload) => {
    try {
      const updatedDelivery = await updateDelivery(id, payload)
      if (updatedDelivery?._id) {
        setState((prev) => ({
          ...prev,
          deliveries: prev.deliveries?.map((d) => (d._id === id ? updatedDelivery : d)),
          myDeliveries: prev.myDeliveries?.map((d) => (d._id === id ? updatedDelivery : d)),
        }))
        makeToast('Requête mise à jour avec succès', 'success')
        return updatedDelivery
      }
      makeToast(updatedDelivery?.error || 'Échec de la mise à jour de la livraison', 'error')
    } catch (error) {
      makeToast(error.message, 'error')
    }
  }, [makeToast])

  const validate = useCallback(async (id) => {
    const validated = await validateDelivery(id)
    if (validated?._id) {
      setState((prev) => ({
        ...prev,
        deliveries: prev.deliveries?.map((d) => (d._id === id ? validated : d)),
        myDeliveries: prev.myDeliveries?.map((d) => (d._id === id ? validated : d)),
      }))
    }
    return validated
  }, [])

  const changeStatus = useCallback(async (id, payload) => {
    try {
      const updatedDelivery = await changeDeliveryStatus(id, payload)
      if (updatedDelivery?._id) {
        setState((prev) => ({
          ...prev,
          deliveries: prev.deliveries?.map((d) => (d._id === id ? updatedDelivery : d)),
          myDeliveries: prev.myDeliveries?.map((d) => (d._id === id ? updatedDelivery : d)),
        }))
        makeToast('Statut de la livraison mis à jour avec succès', 'success')
        return updatedDelivery
      }
      makeToast(
        updatedDelivery?.error || 'Échec de la mise à jour du statut de la livraison',
        'error'
      )
      return updatedDelivery
    } catch (error) {
      makeToast(error.message, 'error')
    }
  }, [makeToast])

  const deleteDeliveryCtx = useCallback(async (id) => {
    try {
      const response = await deleteDelivery(id)
      if (response?.success) {
        setState((prev) => ({
          ...prev,
          deliveries: prev.deliveries.filter((d) => d._id !== id),
          myDeliveries: prev.myDeliveries.filter((d) => d._id !== id),
        }))
        makeToast('Requête supprimée avec succès', 'success')
        return true
      }
      makeToast(response?.error || 'Échec de la suppression de la livraison', 'error')
      return false
    } catch (error) {
      makeToast(error.message, 'error')
    }
  }, [makeToast])

  const value = useMemo(() => ({
    ...state,
    create,
    updateDelivery: updateDeliveryCtx,
    changeStatus,
    validate,
    deleteDelivery: deleteDeliveryCtx,
  }), [state, create, updateDeliveryCtx, changeStatus, validate, deleteDeliveryCtx])

  return (
    <DeliveryContext.Provider value={value}>
      {children}
    </DeliveryContext.Provider>
  )
}
const DeliveryContext = createContext()

export const useDelivery = () => {
  return useContext(DeliveryContext)
}
