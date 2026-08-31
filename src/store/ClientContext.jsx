import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import {
  addClient,
  getAllClients,
  getClientsByArtist,
  updateClient,
  deleteClient,
  uploadClientsFromFile,
} from '../api/useClient'
import { useToast } from './ToastContext'

// État initial pour le contexte des clients
const initialState = {
  clients: [], // Tous les clients (pour admin)
  artistClients: [], // Clients de l'artiste connecté
  loading: false,
  error: null,
}

// Création du contexte des clients
const ClientContext = createContext(initialState)

// Fournisseur du contexte des clients
// Permet de gérer les clients et les actions associées
export function ClientProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(initialState)
  const { makeToast } = useToast()

  // ✅ Load clients according to user role
  useEffect(() => {
    const loadClients = async () => {
      if (!user) return

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        if (user.role === 'admin') {
          // Admin: load all clients
          const allClients = await getAllClients()
          if (allClients?.error) {
            setState((prev) => ({
              ...prev,
              loading: false,
              error: allClients.error,
            }))
          } else {
            setState((prev) => ({
              ...prev,
              clients: allClients || [],
              loading: false,
            }))
          }
        }

        if (user.role === 'artist') {
          // Artist: load their own clients
          const artistClients = await getClientsByArtist()
          if (artistClients?.error) {
            setState((prev) => ({
              ...prev,
              loading: false,
              error: artistClients.error,
            }))
          } else {
            setState((prev) => ({
              ...prev,
              artistClients: artistClients || [],
              loading: false,
            }))
          }
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }))
      }
    }

    loadClients()
  }, [user?._id, user?.role])

  const addClientCtx = useCallback(async (payload) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const newClient = await addClient(payload)
      if (newClient?.error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: newClient.error,
        }))
        makeToast('Erreur', 'error', newClient.error)
        return { error: newClient.error }
      }

      // Mettre à jour l'état local
      if (user.role === 'artist') {
        setState((prev) => ({
          ...prev,
          artistClients: [newClient, ...prev.artistClients],
          loading: false,
        }))
      }

      if (user.role === 'admin') {
        setState((prev) => ({
          ...prev,
          clients: [newClient, ...prev.clients],
          loading: false,
        }))
      }

      makeToast('Succès', 'success', 'Client ajouté avec succès')
      return newClient
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }))
      makeToast('Erreur', 'error', error.message)
      return { error: error.message }
    }
  }, [user?.role, makeToast])

  const updateClientCtx = useCallback(async (id, payload) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const updatedClient = await updateClient(id, payload)
      if (updatedClient?.error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: updatedClient.error,
        }))
        makeToast('Erreur', 'error', updatedClient.error)
        return { error: updatedClient.error }
      }

      // Mettre à jour l'état local
      if (user.role === 'artist') {
        setState((prev) => ({
          ...prev,
          artistClients: prev.artistClients.map((client) =>
            client._id === id ? updatedClient : client
          ),
          loading: false,
        }))
      }

      if (user.role === 'admin') {
        setState((prev) => ({
          ...prev,
          clients: prev.clients.map((client) => (client._id === id ? updatedClient : client)),
          loading: false,
        }))
      }

      makeToast('Succès', 'success', 'Client mis à jour avec succès')
      return updatedClient
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }))
      makeToast('Erreur', 'error', error.message)
      return { error: error.message }
    }
  }, [user?.role, makeToast])

  const deleteClientCtx = useCallback(async (id) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const result = await deleteClient(id)
      if (result?.error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error,
        }))
        makeToast('Erreur', 'error', result.error)
        return { error: result.error }
      }

      // Mettre à jour l'état local (retirer de la liste artiste, garder dans admin)
      if (user.role === 'artist') {
        setState((prev) => ({
          ...prev,
          artistClients: prev.artistClients.filter((client) => client._id !== id),
          loading: false,
        }))
      }

      if (user.role === 'admin') {
        // Pour l'admin, marquer comme supprimé mais garder dans la liste
        setState((prev) => ({
          ...prev,
          clients: prev.clients.map((client) =>
            client._id === id ? { ...client, isDeletedByArtist: true } : client
          ),
          loading: false,
        }))
      }

      makeToast('Succès', 'success', 'Client supprimé avec succès')
      return result
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }))
      makeToast('Erreur', 'error', error.message)
      return { error: error.message }
    }
  }, [user?.role, makeToast])

  const uploadClients = useCallback(async (file) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const result = await uploadClientsFromFile(file)
      if (result?.error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error,
        }))
        makeToast('Erreur', 'error', result.error)
        return { error: result.error }
      }

      // Recharger les clients après l'import
      if (user.role === 'artist') {
        const artistClients = await getClientsByArtist()
        if (!artistClients?.error) {
          setState((prev) => ({
            ...prev,
            artistClients: artistClients || [],
            loading: false,
          }))
        }
      }

      if (user.role === 'admin') {
        const allClients = await getAllClients()
        if (!allClients?.error) {
          setState((prev) => ({
            ...prev,
            clients: allClients || [],
            loading: false,
          }))
        }
      }

      makeToast('Succès', 'success', result.message || 'Import réussi')
      return result
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }))
      makeToast('Erreur', 'error', error.message)
      return { error: error.message }
    }
  }, [user?.role, makeToast])

  const refreshClients = useCallback(async () => {
    if (!user) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      if (user.role === 'admin') {
        const allClients = await getAllClients()
        if (allClients?.error) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: allClients.error,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            clients: allClients || [],
            loading: false,
          }))
        }
      }

      if (user.role === 'artist') {
        const artistClients = await getClientsByArtist()
        if (artistClients?.error) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: artistClients.error,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            artistClients: artistClients || [],
            loading: false,
          }))
        }
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }))
    }
  }, [user?.role])

  const value = useMemo(() => ({
    ...state,
    addClient: addClientCtx,
    updateClient: updateClientCtx,
    deleteClient: deleteClientCtx,
    uploadClients,
    refreshClients,
  }), [state, addClientCtx, updateClientCtx, deleteClientCtx, uploadClients, refreshClients])

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClients() {
  return useContext(ClientContext)
}
