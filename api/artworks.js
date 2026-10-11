/**
 * api/artworks.js
 *
 * STANDALONE ARTWORKS ENDPOINT
 * Completely separate from the problematic [...path].js
 * Cannot have any conflicts or cached issues
 */

export default async function handler(req, res) {
  // ✅ CORS: Use environment variable, not wildcard
  const corsOrigin = process.env.CORS_ORIGIN || 'https://kucibok.com'
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')

  // ✅ Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; img-src 'self' data: https:; frame-ancestors 'none'"
  )
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.removeHeader('ETag')
  res.removeHeader('Last-Modified')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Import Supabase dynamically
    const { createClient } = await import('@supabase/supabase-js')

    // Get env vars
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(503).json({
        error: 'Database not configured',
        success: false,
        data: [],
      })
    }

    // Create client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Parse query params
    const { status, page = '1', limit = '12' } = req.query

    // Query database with artist data
    // For dev: include all statuses (status param is ignored)
    let query = supabase
      .from('artworks')
      .select('*, artists(id, name)')
      .order('created_at', { ascending: false })

    // Public endpoint: only approved artworks are ever returned (rejected/pending stay hidden)
    query = query.eq('status', 'approved')

    query = query.limit(300)
    const { data, error } = await query

    if (error) {
      return res.status(500).json({
        error: error.message,
        success: false,
        data: [],
      })
    }

    // Map artist data: add 'artist' field with artist name
    const artworksWithArtistNames = (data || []).map((artwork) => ({
      ...artwork,
      artist: artwork.artists?.name || artwork.artist || 'Unknown artist',
    }))

    // Return artworks in format expected by frontend
    res.status(200).json({
      success: true,
      data: artworksWithArtistNames,
      count: artworksWithArtistNames.length,
      pagination: { total: artworksWithArtistNames.length },
    })
  } catch (error) {
    res.status(500).json({
      error: error.message,
      success: false,
      artworks: [],
    })
  }
}
