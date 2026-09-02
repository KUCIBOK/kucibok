/**
 * src/api/useArtistContextQuery.js - React Query hook for artist data
 * Replaces ArtistContext
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext'
import {
  createArtist,
  getAllArtists,
  getArtistById,
  getFeaturedArtists,
  getManagedArtists,
  updateManagedArtist,
} from './useArtists'
import { getArtistForSaleArtworks } from './useArtworks'

async function fetchAllArtists() {
  const artists = await getAllArtists({ limit: 1000 })
  return artists ? artists.reverse() : []
}

async function fetchFeaturedArtists() {
  return getFeaturedArtists()
}

export function useArtist() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { makeToast } = useToast()

  // Query: all artists
  const allArtistsQuery = useQuery({
    queryKey: ['artists', 'all'],
    queryFn: fetchAllArtists,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  })

  // Query: featured artists
  const featuredQuery = useQuery({
    queryKey: ['artists', 'featured'],
    queryFn: fetchFeaturedArtists,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  })

  // Query: my managed artists (for curators/buyers)
  const myArtistsQuery = useQuery({
    queryKey: ['artists', 'my', user?.id],
    queryFn: () => user?.id ? getManagedArtists(user.id) : Promise.resolve([]),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    enabled: !!(user?.role === 'curator' || user?.role === 'buyer') && !!user?.id,
  })

  // Mutation: create artist
  const createMutation = useMutation({
    mutationFn: createArtist,
    onSuccess: (artist) => {
      if (artist?._id) {
        queryClient.setQueryData(['artists', 'my', user?.id], (old) =>
          [artist, ...(old || [])]
        )
        makeToast('Succès', 'success', 'Artiste créé avec succès')
      }
    },
    onError: (error) => {
      makeToast('Erreur', 'warning', error?.message || "Impossible de créer l'artiste")
    },
  })

  // Mutation: update artist
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateManagedArtist(id, payload),
    onSuccess: (artist) => {
      if (artist?._id) {
        queryClient.setQueryData(['artists', 'my', user?.id], (old) =>
          [artist, ...(old || []).filter((item) => item?._id !== artist?._id)]
        )
        makeToast('Succès', 'success', 'Artiste mis à jour avec succès')
      }
    },
    onError: (error) => {
      makeToast('Erreur', 'warning', error?.message || "Impossible de mettre à jour l'artiste")
    },
  })

  return {
    artists: allArtistsQuery.data || [],
    myArtists: myArtistsQuery.data || [],
    featuredArtists: featuredQuery.data || [],
    loading: allArtistsQuery.isLoading || featuredQuery.isLoading || myArtistsQuery.isLoading,

    // Functions
    getArtistById: (id) => getArtistById(id),
    getArtistArtworks: (id) => getArtistForSaleArtworks(id),
    create: (payload) => createMutation.mutateAsync(payload),
    update: (id, payload) => updateMutation.mutateAsync({ id, payload }),

    // Utilities
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
    },
  }
}
