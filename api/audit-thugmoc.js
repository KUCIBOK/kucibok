/**
 * api/audit-thugmoc.js — Deep audit endpoint for 0→300 jump bug
 *
 * Usage: GET /api/audit-thugmoc?email=thugmoc@gmail.com
 * Response: Complete diagnostic data
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export default async function handler(req, res) {
  // ✅ CORS & security headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'https://kucibok.com')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, kcb-api-key')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email = 'thugmoc@gmail.com' } = req.query

    console.log(`[Audit] Starting deep audit for: ${email}`)

    // ════════════════════════════════════════════════════════════════
    // 1️⃣ FIND USER
    // ════════════════════════════════════════════════════════════════
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    const user = users?.users?.find(u => u.email === email)

    if (!user) {
      return res.status(404).json({ error: `User not found: ${email}` })
    }

    // ════════════════════════════════════════════════════════════════
    // 2️⃣ FIND ARTIST PROFILE
    // ════════════════════════════════════════════════════════════════
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // ════════════════════════════════════════════════════════════════
    // 3️⃣ COUNT ARTWORKS BY FILTERS
    // ════════════════════════════════════════════════════════════════
    const { count: totalArtworks } = await supabaseAdmin
      .from('artworks')
      .select('*', { count: 'exact', head: true })

    let byArtistId = 0
    if (artist?.id) {
      const { count } = await supabaseAdmin
        .from('artworks')
        .select('*', { count: 'exact', head: true })
        .eq('artist_id', artist.id)
      byArtistId = count
    }

    const { count: byUserId } = await supabaseAdmin
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: byStatusApproved } = await supabaseAdmin
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    const { count: byStatusPending } = await supabaseAdmin
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { count: byStatusNull } = await supabaseAdmin
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .is('status', null)

    // ════════════════════════════════════════════════════════════════
    // 4️⃣ GET FIRST 10 ARTWORKS FOR ARTIST
    // ════════════════════════════════════════════════════════════════
    let firstArtworks = []
    if (artist?.id) {
      const { data: artworks } = await supabaseAdmin
        .from('artworks')
        .select('id, kucibok_id, title, artist_id, user_id, status, created_at')
        .eq('artist_id', artist.id)
        .order('created_at', { ascending: false })
        .limit(10)

      firstArtworks = artworks || []
    }

    // ════════════════════════════════════════════════════════════════
    // 5️⃣ SIMULATE API CALL (what backend returns)
    // ════════════════════════════════════════════════════════════════
    let simulated = []
    if (artist?.id) {
      const { data: sim } = await supabaseAdmin
        .from('artworks')
        .select('id, kucibok_id, title, artist_id, status')
        .eq('artist_id', artist.id)
        .limit(350)

      simulated = sim || []
    }

    // ════════════════════════════════════════════════════════════════
    // 6️⃣ CHECK FOR ANOMALIES
    // ════════════════════════════════════════════════════════════════
    const { data: nullStatusArtworks } = await supabaseAdmin
      .from('artworks')
      .select('id, title, artist_id, status')
      .is('status', null)
      .limit(5)

    // ════════════════════════════════════════════════════════════════
    // RESPONSE
    // ════════════════════════════════════════════════════════════════
    return res.status(200).json({
      success: true,
      audit: {
        email,
        user: {
          id: user.id,
          email: user.email,
          role: user.user_metadata?.role,
          created_at: user.created_at,
        },
        artist: artist ? {
          id: artist.id,
          user_id: artist.user_id,
          name: artist.name,
          status: artist.status,
          created_at: artist.created_at,
        } : null,
        counts: {
          total_artworks_in_system: totalArtworks,
          by_artist_id: byArtistId,
          by_user_id: byUserId,
          by_status_approved: byStatusApproved,
          by_status_pending: byStatusPending,
          by_status_null: byStatusNull,
        },
        first_10_artworks: firstArtworks.map(a => ({
          kucibok_id: a.kucibok_id || a.id.substring(0, 8),
          title: a.title,
          artist_id: a.artist_id,
          user_id: a.user_id,
          status: a.status || 'NULL',
        })),
        api_simulation: {
          expected_count: simulated.length,
          first_artwork_artist_id: simulated[0]?.artist_id || null,
          filter_matches: simulated[0]?.artist_id === artist?.id ? 'YES ✓' : 'NO ✗ MISMATCH',
          sample: simulated.slice(0, 5).map(s => ({
            kucibok_id: s.kucibok_id || s.id.substring(0, 8),
            title: s.title,
            artist_id: s.artist_id,
            status: s.status || 'NULL',
          })),
        },
        anomalies: {
          null_status_artworks: nullStatusArtworks?.length || 0,
          null_status_samples: nullStatusArtworks?.map(a => ({
            title: a.title,
            artist_id: a.artist_id,
          })) || [],
        },
        diagnosis: {
          scenario: byArtistId === 0 ? 'Artist has 0 artworks but 300 showing' :
                    byArtistId < 50 ? `Artist has ${byArtistId} artworks but 300+ showing` :
                    `Artist has ${byArtistId} artworks, showing ${simulated.length}`,
          likely_issues: generateDiagnosis(byArtistId, simulated.length, artist?.id),
        },
      },
    })
  } catch (error) {
    console.error('[Audit Error]', error)
    return res.status(500).json({
      error: error.message,
      success: false,
    })
  }
}

function generateDiagnosis(byArtistId, simulatedCount, artistId) {
  const issues = []

  if (!artistId) {
    issues.push('Artist profile not found for this user')
  }

  if (byArtistId === 0 && simulatedCount === 0) {
    issues.push('No artworks exist for this artist')
  }

  if (byArtistId > 0 && simulatedCount === 0) {
    issues.push('Artworks exist but filter by artist_id returns nothing')
  }

  if (simulatedCount > 200) {
    issues.push('Returning ' + simulatedCount + ' artworks (should be < 50 usually)')
    issues.push('Check: Are all 300 artworks actually owned by this artist?')
  }

  if (byArtistId > 0 && simulatedCount > byArtistId * 2) {
    issues.push('API returns more artworks than expected by artist_id filter')
  }

  if (issues.length === 0) {
    issues.push('Cannot determine root cause from available data')
    issues.push('Check frontend console logs for artist_id being passed')
  }

  return issues
}
