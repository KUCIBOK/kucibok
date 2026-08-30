import { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react'
import {
  fetchArtworks,
  getAllArtworks,
  getApprovedArtworks,
  getForSaleArtworks,
  getManagedArtworks,
  getMyArtworks,
  getOwnerArtworks,
  getPendingArtworks,
  getRandomArtworks,
  getRandomArtworksByCategories,
  getRejectedArtworks,
  purchaseArtwork,
  setArtworkStatus,
  submitArtwork,
  updateArtwork,
  updateEtherscan,
} from '../api/useArtworks'

/** Fisher-Yates — identique à useArtworks.js */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import { createLog } from '../api/useLog'

const initialState = {
  artworks: [],
  forSale: [],
  buyed: [],
  pending: [],
  approved: [],
  rejected: [],
  myArtworks: [],
  featured: [],
  categoryFeatured: [],
  loading: true,
}

const ArtworksContext = createContext(initialState)

export const ArtworksContextProvider = ({ children }) => {
  const [state, setState] = useState(initialState)
  const { user, artistProfile, curatorProfile } = useAuth()
  const { makeToast } = useToast()
  const loadedProfilesRef = useRef(new Set()) // Track which profiles we've already loaded
  // ✅ FIX: Load public artworks (don't block dashboard loading)
  useEffect(() => {
    const loadPublicArtworks = async () => {
      try {
        // Load public artworks in parallel
        const [forSale, featured, categoryFeatured] = await Promise.all([
          getForSaleArtworks(),
          getRandomArtworks(),
          getRandomArtworksByCategories('sculpture'),
        ])

        setState((prev) => ({
          ...prev,
          forSale: (Array.isArray(forSale) ? forSale : []).filter(
            (item) => item?.status === 'approved' && item?.for_sale && !item?.sold
          ),
          featured: Array.isArray(featured) ? featured : [],
          categoryFeatured: Array.isArray(categoryFeatured) ? categoryFeatured : [],
        }))
      } catch (error) {
        console.warn('[ArtworkContext] Error loading public artworks:', error.message)
      }
    }

    loadPublicArtworks()
  }, [])

  useEffect(() => {
    console.log('[ArtworkContext] useEffect triggered - user:', user?._id, 'role:', user?.role, 'artistProfile?.id:', artistProfile?.id)

    // ✅ FIX: Don't run until user AND profile are loaded
    if (!user?._id) {
      setState((prev) => ({ ...prev, loading: false }))
      return
    }

    // ✅ CRITICAL: For artists/curators, WAIT for their profile to load first
    if ((user?.role === 'artist' || user?.role === 'curator') && !artistProfile?.id) {
      console.warn('[ArtworkContext] Waiting for artist/curator profile to load...')
      return // Wait for next effect run when artistProfile is available
    }

    // ✅ PREVENT DOUBLE-LOADS: Check if we've already loaded this user's artworks
    // Use user._id as key, not artistProfile.id (which may be undefined initially)
    if (user?._id && loadedProfilesRef.current.has(user._id)) {
      console.log('[ArtworkContext] User artworks already loaded:', user._id)
      setState((prev) => ({ ...prev, loading: false }))
      return
    }

    const getProfileArtworks = async () => {
        if (user?.role == 'admin') {
          // Fetch par statut séparément pour éviter la limite de pagination
          const [pending, approved, rejected] = await Promise.all([
            getPendingArtworks(),
            getApprovedArtworks(),
            getRejectedArtworks(),
          ])
          const allArtworks = [
            ...(Array.isArray(pending) ? pending : []),
            ...(Array.isArray(approved) ? approved : []),
            ...(Array.isArray(rejected) ? rejected : []),
          ]
          setState((prev) => ({
            ...prev,
            artworks: allArtworks,
            pending: Array.isArray(pending) ? [...pending].reverse() : [],
            approved: Array.isArray(approved) ? [...approved].reverse() : [],
            rejected: Array.isArray(rejected) ? [...rejected].reverse() : [],
          }))
          return
        }

        // ✅ ARTIST: Fetch only their own artworks (by artist_id)
        if (user?.role == 'artist') {
          if (!artistProfile?.id) {
            console.warn('[ArtworkContext] Artist profile ID missing!', { artistProfile })
            setState((prev) => ({
              ...prev,
              myArtworks: [],
              loading: false,
            }))
            return
          }
          const result = await getMyArtworks(artistProfile?.id)
          const myArtworks = result?.error ? [] : (Array.isArray(result) ? result : [])
          loadedProfilesRef.current.add(user._id) // Mark user as loaded
          setState((prev) => ({
            ...prev,
            myArtworks,
            loading: false,
          }))
          return
        }

        // ✅ BUYER: Fetch their purchases
        if (user?.role == 'buyer') {
          const buyedResult = await getOwnerArtworks(user?._id)
          const managedResult = await getManagedArtworks()
          const buyed = buyedResult?.error ? [] : (Array.isArray(buyedResult) ? buyedResult : [])
          const myArtworks = managedResult?.error ? [] : (Array.isArray(managedResult) ? managedResult : [])
          setState((prev) => ({
            ...prev,
            buyed: buyed?.length > 0 ? [...buyed].reverse() : [],
            myArtworks: myArtworks?.length > 0 ? [...myArtworks].reverse() : [],
            loading: false,
          }))
          return
        }

        // ✅ CURATOR: Fetch managed artworks
        if (user?.role == 'curator') {
          const result = await getManagedArtworks()
          const myArtworks = result?.error ? [] : (Array.isArray(result) ? result : [])
          setState((prev) => ({
            ...prev,
            myArtworks: myArtworks?.length > 0 ? [...myArtworks].reverse() : [],
            loading: false,
          }))
          return
        }

        // ✅ ADMIN: Mark loading as done after fetching
        if (user?.role === 'admin') {
          setState((prev) => ({ ...prev, loading: false }))
          return
        }
      }
      // ✅ CRITICAL: Always await the profile artworks load
      // This prevents rendering the dashboard before myArtworks is loaded
      getProfileArtworks()
  }, [user?.id, user?.role, artistProfile?.id, curatorProfile?.id])
  const contextValue = useMemo(
    () => ({
      artworks: state.artworks,
      forSale: state.forSale,
      buyed: state.buyed,
      pending: state.pending,
      approved: state.approved,
      rejected: state.rejected,
      myArtworks: state.myArtworks,
      featured: state?.featured,
      categoryFeatured: state?.categoryFeatured,
      loading: state.loading,
      setArtworkState: setState,
      artworkState: state,
      approveArtwork: async (id, status) => {
        try {
          const artwork = await setArtworkStatus(id, status)
          if (artwork?.id) {
            if (artwork?.status == 'approved') {
              setState((prev) => ({
                ...prev,
                pending: prev.pending?.filter((d) => d.id !== id),
                rejected: prev.rejected?.filter((d) => d.id !== id),
                approved: [artwork, ...prev.approved],
              }))
            } else {
              setState((prev) => ({
                ...prev,
                pending: prev.pending?.filter((item) => item.id !== artwork.id),
                approved: prev.approved?.filter((item) => item.id !== artwork.id),
                rejected: [artwork, ...prev.rejected],
              }))
            }

            makeToast(
              'Félicitations ',
              'success',
              `L'oeuvre a été ${status == 'approved' ? 'approuvée' : 'rejetée'} avec succès`
            )
            await createLog({
              description: `L'oeuvre ${artwork?.id} a été ${status === 'approved' ? 'approuvée' : 'rejetée'}`,
              userId: user?.id,
            })
            return artwork
          }
          makeToast('Erreur', 'warning', artwork?.error)
        } catch (error) {
          makeToast('Erreur', 'warning', error.message)
        }
      },
      submitArtwork: async (artwork) => {
        try {
          const data = await submitArtwork(artwork)
          if (data?.id) {
            // ✅ FIX: Use the status returned by the API, don't force 'pending'
            // The backend decides the initial status based on configuration
            setState((prev) => ({
              ...prev,
              myArtworks: [...prev.myArtworks, data],
            }))
            makeToast('Félicitations ', 'success', `L'oeuvre a été soumise avec succès`)
            await createLog({
              description: `L'oeuvre ${data?.id} a été soumise`,
              userId: user?.id,
            })
            return data
          }
          makeToast('Erreur', 'warning', data?.error)
          return data
        } catch (error) {
          makeToast('Erreur', 'warning', error.message)
          return {
            error: error.message,
          }
        }
      },
      updateArtwork: async (id, payload) => {
        try {
          const artwork = await updateArtwork(id, payload)
          if (artwork?.id) {
            setState((prev) => ({
              ...prev,
              myArtworks: prev.myArtworks?.map((d) => (d.id === id ? artwork : d)),
            }))
            makeToast('Succès', 'success', 'Oeuvre mise à jour avec succès')
            await createLog({
              description: `L'oeuvre ${artwork?.id} a été mise à jour`,
              userId: user?.id,
            })
            return artwork
          }
          makeToast('Erreur', 'warning', artwork?.error || "Impossible de mettre à jour l'oeuvre")
          return {
            error: artwork?.error || artwork?.message,
          }
        } catch (error) {
          makeToast('Erreur', 'warning', error.message)
          return {
            error: error.message,
          }
        }
      },
      purchaseArtwork: async (artwork, payload) => {
        try {
          const data = await purchaseArtwork(artwork, payload)
          if (data?.id) {
            setState((prev) => ({
              ...prev,
              forSale: prev.forSale?.filter(
                (item) => item._id != artwork?.id && item.id != artwork?.id
              ),
            }))
            makeToast('Félicitations ', 'success', `Vous avez acheté une oeuvre`)
            await createLog({
              description: `L'oeuvre ${artwork?._id} a été achetée`,
              userId: user?._id,
            })
            return data
          }
          return {
            error: data?.error || data?.message,
          }
        } catch (error) {
          makeToast('Erreur', 'warning', error.message)
          return {
            error: error.message,
          }
        }
      },
      modifyEtherscan: async (id, etherscan) => {
        try {
          const artwork = await updateEtherscan(id, etherscan)
          if (!artwork?._id) return { error: artwork?.error }
          if (artwork?.status == 'pending')
            setState((prev) => ({
              ...prev,
              pending: prev.pending?.map((d) => (d._id === id ? artwork : d)),
            }))
          if (artwork?.status == 'rejected')
            setState((prev) => ({
              ...prev,
              rejected: prev.rejected?.map((d) => (d._id === id ? artwork : d)),
            }))
          if (artwork?.status == 'approved')
            setState((prev) => ({
              ...prev,
              approved: prev.approved?.map((d) => (d._id === id ? artwork : d)),
            }))
          makeToast(
            'Succès',
            'success',
            "L'adresse etherscan de l'oeuvre a été modifiée avec succès"
          )
          await createLog({
            description: `L'adresse etherscan de l'oeuvre ${artwork?._id} a été modifiée`,
            userId: user?._id,
          })
          return artwork
        } catch (error) {
          return {
            error: error.message,
          }
        }
      },
       
    }),
    [state, user, makeToast]
  )

  return <ArtworksContext.Provider value={contextValue}>{children}</ArtworksContext.Provider>
}

export function useArtworks() {
  return useContext(ArtworksContext)
}
