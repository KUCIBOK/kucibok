import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { getAllGalleries } from '../api/useGallery'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'

const initialState = {
  galleries: [],
}

const GalleryContext = createContext(initialState)

export const GalleryContextProvider = ({ children }) => {
  const [state, setState] = useState({ galleries: [], total: 0, filtered: 0, loading: true })
  const { makeToast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    const fetchGalleries = async () => {
      const result = await getAllGalleries()
      setState({
        galleries: Array.isArray(result.galleries) ? result.galleries : [],
        total: typeof result.total === 'number' ? result.total : (result.galleries?.length ?? 0),
        filtered:
          typeof result.filtered === 'number' ? result.filtered : (result.galleries?.length ?? 0),
      })
      // Background fetch — errors are silent; only explicit refresh() shows a toast
    }
    if (user?.role == 'admin') {
      fetchGalleries().finally(() => {
        setState((prev) => ({ ...prev, loading: false }))
      })
    } else {
      setState((prev) => ({ ...prev, loading: false }))  
    }
  }, [user?.role])

  // expose a simple refresh method for components (e.g., after import)
  const refresh = useCallback(async () => {
    const result = await getAllGalleries()
    setState({
      galleries: Array.isArray(result.galleries) ? result.galleries : [],
      total: typeof result.total === 'number' ? result.total : (result.galleries?.length ?? 0),
      filtered:
        typeof result.filtered === 'number' ? result.filtered : (result.galleries?.length ?? 0),
    })
    if (result?.error) {
      makeToast('Erreur', 'warning', result.error)
    }
  }, [makeToast])

  const value = useMemo(() => ({
    galleries: state.galleries,
    total: state.total,
    filtered: state.filtered,
    loading: state.loading,
    refresh,
  }), [state, refresh])

  return (
    <GalleryContext.Provider value={value}>
      {children}
    </GalleryContext.Provider>
  )
}

export const useGalleries = () => useContext(GalleryContext)
