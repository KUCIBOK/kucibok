/**
 * useShortlist.js — Hooks pour gérer le shortlisting d'artworks
 * Phase 2 Update: Added new userId-based functions + restored old session-based functions
 */

import { useCallback, useState } from 'react'
import { utils } from './useAPI'
import { supabase } from '../lib/supabase'

const { api } = utils

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY FUNCTIONS (Session-based, for existing components like CuratorCatalogue)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add artwork to shortlist (uses current session user)
 * @param {string} artworkId
 * @returns {Promise<{ success: boolean, data?, error? }>}
 */
export async function addToShortlistSession(artworkId) {
  try {
    const { data: session } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      return { success: false, error: 'Not authenticated' }
    }

    const res = await fetch(`${api}/shortlist/${artworkId}`, {
      method: 'POST',
      headers: { ...utils.options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, notes: '' }),
    })

    const body = await res.json()
    if (!res.ok) {
      return { success: false, error: body?.error ?? 'Failed to add to shortlist' }
    }

    return { success: true, data: body.data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Remove artwork from shortlist (uses current session user)
 * @param {string} artworkId
 * @returns {Promise<{ success: boolean, error? }>}
 */
export async function removeFromShortlistSession(artworkId) {
  try {
    const { data: session } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      return { success: false, error: 'Not authenticated' }
    }

    const res = await fetch(`${api}/shortlist/${artworkId}`, {
      method: 'DELETE',
      headers: { ...utils.options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })

    const body = await res.json()
    if (!res.ok) {
      return { success: false, error: body?.error ?? 'Failed to remove from shortlist' }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Check if artwork is shortlisted (uses current session user)
 * @param {string} artworkId
 * @returns {Promise<{ success: boolean, isShortlisted?: boolean, error? }>}
 */
export async function checkShortlistedSession(artworkId) {
  try {
    const { data: session } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      return { success: false, error: 'Not authenticated' }
    }

    const res = await fetch(`${api}/shortlist/check/${artworkId}`, utils.options)
    const body = await res.json()

    if (!res.ok) {
      return { success: false, error: body?.error ?? 'Failed to check shortlist' }
    }

    return { success: true, isShortlisted: body.isShortlisted ?? false }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Get user's shortlist (uses current session user)
 * @returns {Promise<{ success: boolean, data?: array, error? }>}
 */
export async function getMyShortlistSession() {
  try {
    const { data: session } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      return { success: false, error: 'Not authenticated', data: [] }
    }

    const res = await fetch(`${api}/shortlist`, utils.options)
    const body = await res.json()

    if (!res.ok) {
      console.error('[useGetMyShortlist]', res.status, body?.error)
      return { success: false, error: body?.error ?? `Failed to fetch shortlist (${res.status})`, data: [] }
    }

    return { success: true, data: body.data || [], count: body.count || 0 }
  } catch (err) {
    console.error('[useGetMyShortlist Exception]', err.message)
    return { success: false, error: err.message, data: [] }
  }
}

/**
 * Update shortlist notes (uses current session user)
 * @param {string} artworkId
 * @param {string} notes
 * @returns {Promise<{ success: boolean, data?, error? }>}
 */
export async function useUpdateShortlistNotes(artworkId, notes) {
  try {
    const { data: session } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      return { success: false, error: 'Not authenticated' }
    }

    const res = await fetch(`${api}/shortlist/${artworkId}`, {
      method: 'PATCH',
      headers: { ...utils.options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, notes }),
    })

    const body = await res.json()
    if (!res.ok) {
      return { success: false, error: body?.error ?? 'Failed to update notes' }
    }

    return { success: true, data: body.data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW FUNCTIONS (userId-based, for new components)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get user's shortlist with artworks
 * @param {string} userId
 * @returns {Promise<{success, data, count, error}>}
 */
export async function getMyShortlist(userId) {
  if (!userId) return { success: false, error: 'userId required', data: [] }

  try {
    const res = await fetch(`${api}/shortlist`, utils.options)
    const body = await res.json()

    if (!res.ok) return { success: false, error: body?.error ?? 'Failed to fetch shortlist', data: [] }
    return { success: true, data: body.data || [], count: body.count || 0 }
  } catch (err) {
    return { success: false, error: err.message, data: [] }
  }
}

/**
 * Add artwork to shortlist
 * @param {string} userId
 * @param {string} artworkId
 * @param {string} notes optional
 * @returns {Promise<{success, data, error}>}
 */
export async function addToShortlist(userId, artworkId, notes = '') {
  if (!userId || !artworkId) return { success: false, error: 'userId and artworkId required' }

  try {
    const res = await fetch(`${api}/shortlist/${artworkId}`, {
      method: 'POST',
      headers: { ...utils.options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, notes }),
    })

    const body = await res.json()

    if (!res.ok) {
      if (res.status === 409) return { success: false, error: 'Already shortlisted' }
      return { success: false, error: body?.error ?? 'Failed to add to shortlist' }
    }

    return { success: true, data: body.data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Remove artwork from shortlist
 * @param {string} userId
 * @param {string} artworkId
 * @returns {Promise<{success, error}>}
 */
export async function removeFromShortlist(userId, artworkId) {
  if (!userId || !artworkId) return { success: false, error: 'userId and artworkId required' }

  try {
    const res = await fetch(`${api}/shortlist/${artworkId}`, {
      method: 'DELETE',
      headers: { ...utils.options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })

    const body = await res.json()

    if (!res.ok) return { success: false, error: body?.error ?? 'Failed to remove from shortlist' }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Check if artwork is shortlisted
 * @param {string} userId
 * @param {string} artworkId
 * @returns {Promise<{success, isShortlisted, error}>}
 */
export async function checkIsShortlisted(userId, artworkId) {
  if (!userId || !artworkId) return { success: false, isShortlisted: false }

  try {
    const res = await fetch(`${api}/shortlist/check/${artworkId}`, utils.options)
    const body = await res.json()

    if (!res.ok) return { success: false, isShortlisted: false }
    return { success: true, isShortlisted: body.isShortlisted || false }
  } catch (err) {
    return { success: false, isShortlisted: false }
  }
}

/**
 * Update shortlist notes
 * @param {string} userId
 * @param {string} artworkId
 * @param {string} notes
 * @returns {Promise<{success, data, error}>}
 */
export async function updateShortlistNotes(userId, artworkId, notes) {
  if (!userId || !artworkId) return { success: false, error: 'userId and artworkId required' }

  try {
    const res = await fetch(`${api}/shortlist/${artworkId}`, {
      method: 'PATCH',
      headers: { ...utils.options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, notes }),
    })

    const body = await res.json()

    if (!res.ok) return { success: false, error: body?.error ?? 'Failed to update notes' }
    return { success: true, data: body.data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook: Toggle shortlist status for an artwork (session-based)
 * Returns { isShortlisted, toggle, loading, checkStatus }
 */
export function useShortlistToggle(artworkId) {
  const [isShortlisted, setIsShortlisted] = useState(false)
  const [loading, setLoading] = useState(false)

  const toggle = useCallback(async () => {
    setLoading(true)
    if (isShortlisted) {
      const result = await removeFromShortlistSession(artworkId)
      if (result.success) setIsShortlisted(false)
    } else {
      const result = await addToShortlistSession(artworkId)
      if (result.success) setIsShortlisted(true)
    }
    setLoading(false)
  }, [artworkId, isShortlisted])

  const checkStatus = useCallback(async () => {
    const result = await checkShortlistedSession(artworkId)
    if (result.success) setIsShortlisted(result.isShortlisted)
  }, [artworkId])

  return { isShortlisted, toggle, loading, checkStatus }
}
