import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
  useEffect(() => {
    const getforSaleArtworks = async () => {
      try {
        const forSale = await getForSaleArtworks()
        if (forSale?.length > 0) {
          shuffleArray(forSale)
          setState((prev) => ({
            ...prev,
            forSale: forSale?.filter(
              (item) => item?.status === 'approved' && item?.for_sale && !item?.sold
            ),
          }))
        }
      } catch (error) {
        makeToast('Erreur', 'danger', error.message)
      }
    }
    const getArtworks = async () => {
      try {
        const featured = await getRandomArtworks()
        if (featured?.length > 0) {
          setState((prev) => ({
            ...prev,
            featured: featured || [],
          }))
        }
      } catch (error) {
        // silent
      }
    }

    const getCategoryFeatured = async () => {
      try {
        const categoryFeatured = await getRandomArtworksByCategories('sculpture')
        if (categoryFeatured?.length > 0) {
          setState((prev) => ({
            ...prev,
            categoryFeatured: categoryFeatured,
          }))
        }
      } catch (error) {
        // silent
      }
    }

    Promise.allSettled([getforSaleArtworks(), getArtworks(), getCategoryFeatured()]).finally(() => {
      setState((prev) => ({ ...prev, loading: false }))
    })
  }, [])

  useEffect(() => {
    if (user?._id) {
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
        }
        if (user?.role == 'artist') {
          console.log('[ArtworkContext] ARTIST DETECTED:', {
            userName: user?.name,
            userId: user?._id,
            artistProfileId: artistProfile?.id,
            hasArtistProfile: !!artistProfile?.id
          })

          // ✅ CRITICAL FIX: Fetch artworks with MULTIPLE strategies
          // 1. Try artist_id if available
          // 2. Always also fetch by user_id as fallback
          // 3. Filter results to ensure we ONLY show this artist's artworks
          let result = null

          if (artistProfile?.id) {
            console.log('[ArtworkContext] Fetching by artist_id:', artistProfile.id)
            result = await getMyArtworks(artistProfile?.id)
          } else {
            console.log('[ArtworkContext] No artistProfile.id, fetching by user_id:', user?._id)
            result = await getOwnerArtworks(user?._id)
          }

          console.log('[ArtworkContext] ARTIST ARTWORKS FETCHED:', {
            resultType: typeof result,
            resultIsArray: Array.isArray(result),
            resultLength: result?.length,
            resultIsError: !!result?.error,
          })

          // ✅ SAFETY: Ensure we only have THIS artist's artworks
          // Filter out any artworks that don't belong to this user
          let myArtworks = Array.isArray(result) ? result : []

          if (myArtworks.length > 0) {
            // Only keep artworks where user_id OR artist_id matches
            myArtworks = myArtworks.filter(artwork =>
              artwork.user_id === user?._id ||
              artwork.artist_id === artistProfile?.id
            )
            console.log('[ArtworkContext] After filtering:', {
              originalCount: (Array.isArray(result) ? result : []).length,
              filteredCount: myArtworks.length,
              titles: myArtworks?.slice(0, 3)?.map(a => a.title)
            })
          }

          setState((prev) => ({
            ...prev,
            myArtworks,
          }))
        }

        if (user?.role == 'buyer') {
          const buyed = await getOwnerArtworks(user?._id)
          const myArtworks = await getManagedArtworks()
          setState((prev) => ({
            ...prev,
            buyed: buyed?.length > 0 ? buyed?.reverse() : [],
            myArtworks: myArtworks?.length > 0 ? myArtworks?.reverse() : [],
          }))
        }
        if (user?.role == 'curator') {
          const myArtworks = await getManagedArtworks()
          setState((prev) => ({
            ...prev,
            myArtworks: myArtworks?.length > 0 ? myArtworks?.reverse() : [],
          }))
        }
      }
      getProfileArtworks()
    }
  }, [user?._id, user?.role, artistProfile?.id, curatorProfile?._id])
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
            setState((prev) => ({
              ...prev,
              myArtworks: [...prev.myArtworks, { ...data, status: 'pending' }],
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
