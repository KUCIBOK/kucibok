/**
 * src/api/useBlogQuery.js - React Query hook for blog management
 * Replaces BlogContext for admin operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../store/ToastContext'
import {
  archivePost,
  createBlogPost,
  getArchivedPosts,
  getPublishedPosts,
  publishPost,
  updateBlogPost,
} from './useBlogPost'

async function fetchBlogPosts() {
  const posts = await getPublishedPosts()
  return posts || []
}

async function fetchArchivePosts() {
  const posts = await getArchivedPosts()
  return posts || []
}

export function useBlogPosts() {
  return useQuery({
    queryKey: ['blog', 'published'],
    queryFn: fetchBlogPosts,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  })
}

export function useBlog() {
  const queryClient = useQueryClient()
  const { makeToast } = useToast()

  const publishedQuery = useQuery({
    queryKey: ['blog', 'published'],
    queryFn: fetchBlogPosts,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  })

  const archiveQuery = useQuery({
    queryKey: ['blog', 'archive'],
    queryFn: fetchArchivePosts,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  })

  const addPostMutation = useMutation({
    mutationFn: createBlogPost,
    onSuccess: (post) => {
      if (post?._id) {
        queryClient.setQueryData(['blog', 'published'], (old) => [post, ...(old || [])])
      }
    },
  })

  const publishPostMutation = useMutation({
    mutationFn: publishPost,
    onSuccess: (post) => {
      if (post?._id) {
        queryClient.setQueryData(['blog', 'published'], (old) => [post, ...(old || [])])
        queryClient.setQueryData(['blog', 'archive'], (old) =>
          (old || []).filter((item) => item._id !== post._id)
        )
      }
    },
  })

  const archivePostMutation = useMutation({
    mutationFn: archivePost,
    onSuccess: (post) => {
      if (post?._id) {
        queryClient.setQueryData(['blog', 'archive'], (old) => [post, ...(old || [])])
        queryClient.setQueryData(['blog', 'published'], (old) =>
          (old || []).filter((item) => item._id !== post._id)
        )
      }
    },
  })

  const updatePostMutation = useMutation({
    mutationFn: ({ id, payload }) => updateBlogPost(id, payload),
    onSuccess: (post) => {
      if (post?._id) {
        if (post.status === 'published') {
          queryClient.setQueryData(['blog', 'published'], (old) =>
            [post, ...(old || []).filter((item) => item._id !== post._id)]
          )
        } else if (post.status === 'archived') {
          queryClient.setQueryData(['blog', 'archive'], (old) =>
            [post, ...(old || []).filter((item) => item._id !== post._id)]
          )
        }
      }
    },
  })

  return {
    blogPosts: publishedQuery.data || [],
    archive: archiveQuery.data || [],
    loading: publishedQuery.isLoading || archiveQuery.isLoading,
    addPost: (payload) => addPostMutation.mutateAsync(payload),
    publishPost: (id) => publishPostMutation.mutateAsync(id),
    archivePost: (id) => archivePostMutation.mutateAsync(id),
    updatePost: (id, payload) => updatePostMutation.mutateAsync({ id, payload }),
  }
}
