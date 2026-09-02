/**
 * src/api/useBlogQuery.js - React Query hook for blog posts
 * Remplace BlogContext avec caching optimal
 */

import { useQuery } from '@tanstack/react-query'
import { utils } from './useAPI'

async function fetchBlogPosts() {
  const res = await fetch(`${utils.api}/blog`, utils.options)
  if (!res.ok) throw new Error('Failed to fetch blog posts')
  return res.json()
}

/**
 * Hook: Get all blog posts
 * ✅ Cached 1 hour (blog posts change rarely)
 * ✅ Auto-refetch on window focus
 *
 * Usage:
 *   const { data, isLoading } = useBlogPosts()
 *   const blogPosts = data || []
 */
export function useBlogPosts() {
  return useQuery({
    queryKey: ['blog', 'posts'],
    queryFn: fetchBlogPosts,
    staleTime: 1000 * 60 * 60,  // 1 hour
    gcTime: 1000 * 60 * 120,    // 2 hours
    retry: 1,
    refetchOnWindowFocus: true,
  })
}
