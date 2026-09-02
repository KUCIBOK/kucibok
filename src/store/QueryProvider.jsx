/**
 * src/store/QueryProvider.jsx — React Query Provider
 *
 * Wraps the app with React Query. Replaces multiple Context providers progressively.
 * Includes DevTools for development (inspect queries, cache, timing).
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '../lib/queryClient'

/**
 * Provides React Query to the entire app
 * Replaces: ArtworksContextProvider, BlogContextProvider, PlanProvider, etc.
 *
 * DevTools:
 * - Dev-only (not in production)
 * - Shows active queries, cache hits/misses, timing
 * - Access: Click floating button (bottom-right)
 *
 * @param {{ children: React.ReactNode }} props
 */
export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* ✨ React Query DevTools — dev-only, inspect all queries */}
      <ReactQueryDevtools
        initialIsOpen={false}
        buttonPosition="bottom-right"
        position="bottom"
      />
    </QueryClientProvider>
  )
}
