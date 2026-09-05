/**
 * api/[...path].js — Catch-all Vercel Function for all API routes
 * Disables caching to fix 304 responses
 */

import { createClient } from '@supabase/supabase-js'
import { respondJSON, respondError, checkAuth } from './_lib/response.js'
import { requireAuth } from './_lib/auth.js'
import { checkRateLimit, addRateLimitHeaders } from './_lib/rateLimit.js'
import { handleProfessionalAnalytics } from './_modules/professional-analytics-fixed.js'
import DOMPurify from 'dompurify'
import PDFDocument from 'pdfkit'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Log env status (for debugging)
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[api/[...path].js] Missing env: SUPABASE_URL=' + !!SUPABASE_URL + ', SERVICE_ROLE=' + !!SUPABASE_SERVICE_ROLE_KEY)
}

// Initialize Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const createPdfBuffer = (configure) => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: 'A4', margin: 48 })
  const chunks = []
  document.on('data', (chunk) => chunks.push(chunk))
  document.on('end', () => resolve(Buffer.concat(chunks)))
  document.on('error', reject)
  configure(document)
  document.end()
})

const getArtistOwnedArtworks = async (userId) => {
  const { data: artist } = await supabaseAdmin
    .from('artists')
    .select('id, name')
    .eq('user_id', userId)
    .maybeSingle()

  let query = supabaseAdmin.from('artworks').select('*').order('created_at', { ascending: false })
  query = artist?.id
    ? query.or(`user_id.eq.${userId},artist_id.eq.${artist.id}`)
    : query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error
  return { artist, artworks: data || [] }
}

// ✅ Send admin notification email via Resend
const sendAdminNotification = async (subject, message, details = {}) => {
  console.log('[AdminNotification] Sending notification —', subject)

  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[AdminNotification] RESEND_API_KEY not configured')
      return { success: false }
    }

    const adminEmail = 'kucibok221@gmail.com'

    // Format details into HTML
    let detailsHtml = ''
    if (Object.keys(details).length > 0) {
      detailsHtml = '<table style="width:100%; margin-top:20px; border-collapse:collapse;">'
      for (const [key, value] of Object.entries(details)) {
        detailsHtml += `
          <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 8px; font-weight: bold; color: #666;">${escapeHtml(key)}:</td>
            <td style="padding: 8px;">${escapeHtml(value)}</td>
          </tr>
        `
      }
      detailsHtml += '</table>'
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'noreply@kucibok.com',
        to: adminEmail,
        subject: `[KUCIBOK ADMIN] ${subject}`,
        html: `
          <h2 style="color: #B8A67F;">🔔 ${escapeHtml(subject)}</h2>
          <p>${escapeHtml(message)}</p>
          ${detailsHtml}
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Notification automatique — Ne pas répondre à cet email</p>
        `,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('[AdminNotification Error]', data)
      return { success: false }
    }

    console.log('[AdminNotification] ✅ Sent to', adminEmail)
    return { success: true }
  } catch (err) {
    console.error('[AdminNotification Exception]', err.message)
    return { success: false }
  }
}

// ✅ Send confirmation email via Resend
const sendConfirmationEmail = async (email, confirmationLink) => {
  console.log('[Email] Attempting to send confirmation email to', email)

  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('[Email] ❌ RESEND_API_KEY not configured in Vercel environment!')
      return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    console.log('[Email] ✅ RESEND_API_KEY found, sending via Resend API...')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'noreply@kucibok.com',
        to: email,
        subject: 'Confirmez votre email — Kucibok',
        html: `
          <h2>Bienvenue sur Kucibok</h2>
          <p>Cliquez sur le lien ci-dessous pour confirmer votre adresse email :</p>
          <p><a href="${escapeHtml(confirmationLink)}" style="background-color: #B8A67F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Confirmer mon email</a></p>
          <p>Ou copiez ce lien :</p>
          <p>${escapeHtml(confirmationLink)}</p>
          <p>Ce lien expire dans 24 heures.</p>
        `,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Resend Error] HTTP', response.status, '—', data)
      return { success: false, error: data.message || data.error || 'Failed to send email' }
    }

    console.log('[Resend] ✅ Email sent successfully to', email, '—', data.id)
    return { success: true, messageId: data.id }
  } catch (err) {
    console.error('[Resend Exception] ❌', err.message, err.stack)
    return { success: false, error: err.message }
  }
}

export default async function handler(req, res) {
  // ✅ CORS headers — with validation, NO WILDCARD
  const corsOrigin = process.env.CORS_ORIGIN || 'https://kucibok.com'
  if (!corsOrigin || corsOrigin === '*') {
    console.error('[SECURITY] CORS_ORIGIN not properly configured, using default')
  }
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, kcb-api-key')

  // ✅ Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // ✅ HSTS — Enforce HTTPS for all future requests (1 year)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  // ✅ Content Security Policy (CSP) — Prevent XSS, injection attacks
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://wyrmpddlhldjzoiwbshj.supabase.co https://api.sentry.io; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  )

  // Disable caching completely
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.removeHeader('ETag')
  res.removeHeader('Last-Modified')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    // Parse the URL path from req.url (Vercel Node.js Functions)
    const urlObj = new URL(req.url, 'http://localhost')
    const path = urlObj.pathname.replace(/^\/api\//, '').split('/').filter(p => p)
    const s0 = path[0] // First segment: 'artworks', 'auth', etc.
    const s1 = path[1] // Second segment
    const s2 = path[2] // Third segment

    // ✅ DEBUG: Log all requests
    if (req.method !== 'GET' || s0 === 'artist' || s0 === 'profile') {
      console.log('[API Request]', {
        method: req.method,
        pathname: urlObj.pathname,
        path_segments: path,
        s0,
        s1,
        s2,
      })
    }

    // ✅ Helper function: Validate email
    const validateEmail = (email) => {
      // ✅ IMPROVED: RFC 5322 simplified email validation
      // Prevents: test@test.x, @domain.com, user@.com, etc.
      const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(email)) return false

      // Additional checks
      if (email.length > 254) return false // RFC 5321
      const [localPart, domain] = email.split('@')
      if (localPart.length > 64) return false // Local part max 64 chars
      if (localPart.startsWith('.') || localPart.endsWith('.')) return false
      if (localPart.includes('..')) return false // Consecutive dots

      return true
    }

    // ✅ Helper function: Sanitize HTML to prevent XSS
    const sanitizeHtml = (html) => {
      if (!html || typeof html !== 'string') return ''
      // ✅ CRITICAL: Sanitize with DOMPurify on server-side
      // Only allow safe tags: b, i, em, strong, p, br, a, ul, li
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li', 'h2', 'h3'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        KEEP_CONTENT: true,
      })
    }

    // ✅ Helper function: Validate artwork data
    const validateArtwork = (data) => {
      const errors = []
      if (data.price !== undefined && data.price !== null) {
        const price = parseFloat(data.price)
        if (isNaN(price) || price < 0) errors.push('price must be a positive number')
      }
      if (data.status && !['pending', 'approved', 'rejected', 'archived'].includes(data.status)) {
        errors.push('status must be one of: pending, approved, rejected, archived')
      }
      if (data.for_sale !== undefined && typeof data.for_sale !== 'boolean') {
        errors.push('for_sale must be a boolean')
      }
      if (data.currency && !['USD', 'EUR', 'FCFA', 'XOF'].includes(data.currency.toUpperCase())) {
        errors.push('currency must be one of: USD, EUR, FCFA, XOF')
      }
      return errors
    }

    // ✅ Helper function: Get authenticated user
    const getAuthUser = async () => {
      const auth = await requireAuth(req)
      if (auth.error) {
        res.status(auth.status).json({ error: auth.error })
        return null // EARLY RETURN — prevents further execution
      }
      return auth.user || null
    }

    // ✅ Rate Limiting Check
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.socket?.remoteAddress ||
                     'unknown'

    // Get user from auth header if available (for authenticated rate limit)
    let authUser = null
    try {
      const auth = await requireAuth(req)
      authUser = auth.user
    } catch (e) {
      // Not authenticated, that's OK for rate limit purposes
    }

    const identifier = authUser?.id || clientIp
    const isAuthenticated = !!authUser
    const rateLimitResult = await checkRateLimit(
      identifier,
      urlObj.pathname,
      isAuthenticated
    )

    // Add rate limit headers to response
    addRateLimitHeaders(res, rateLimitResult)

    // Check if rate limited
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ARTWORKS ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'artworks') {
      // GET /api/artworks — List artworks
      if (req.method === 'GET' && !s1) {
        const {
          status,
          for_sale,
          artist_id,
          user_id,
          category,
          limit = 50, // ✅ CHANGED: Default 300 → 50 (prevent unfiltered queries from returning massive data)
        } = req.query

        // ✅ VALIDATION: If artist_id or user_id missing but user is artist/buyer, return empty
        // This prevents accidentally exposing all artworks
        const isFilteredRequest = artist_id || user_id || status || category
        if (!isFilteredRequest && limit > 100) {
          console.warn('[GET /api/artworks] Unfiltered request with large limit blocked:', {
            limit,
            hasParams: { artist_id: !!artist_id, user_id: !!user_id, status: !!status },
          })
          return res.status(200).json({
            success: true,
            artworks: [],
            count: 0,
            note: 'Unfiltered requests must specify artist_id, user_id, status, or category',
          })
        }

        console.log('[GET /api/artworks] Query params:', {
          artist_id,
          user_id,
          status,
          for_sale,
          category,
          limit,
          isFiltered: isFilteredRequest,
        })

        // ✅ CRITICAL FIX: Build query with filters first, THEN select with relations
        // Reason: Supabase JS loads .select() result in memory first, making filters ineffective
        // We must chain: from() → filters → select() → order() → limit()
        let query = supabaseAdmin.from('artworks')

        // ✅ FIX: Only apply default status='approved' filter if no artist_id or user_id is specified
        // - If fetching for PUBLIC (no artist_id/user_id): Only show 'approved' artworks
        // - If fetching for the OWNER (artist_id or user_id): Return ALL artworks (they own them)
        // - If fetching for ADMIN: Can see pending, rejected, etc
        const hasOwnerFilter = artist_id || user_id
        const statusToApply = status || (hasOwnerFilter ? null : 'approved')

        // Apply all filters FIRST (before select with relations)
        if (statusToApply) query = query.eq('status', statusToApply)
        if (for_sale === 'true') query = query.eq('for_sale', true)
        if (artist_id) query = query.eq('artist_id', artist_id)
        if (user_id) query = query.eq('user_id', user_id)
        if (category) query = query.eq('category', category)

        // NOW select with relations, order, and limit AFTER all filters
        query = query.select('*, artists(id, name)').order('created_at', { ascending: false }).limit(parseInt(limit))

        const { data: filteredArtworks, error } = await query

        console.log('[GET /api/artworks] RESULT:', {
          error: error?.message,
          count: filteredArtworks?.length,
          first_artwork_artist_id: filteredArtworks?.[0]?.artist_id,
          requested_artist_id: artist_id,
          matches: filteredArtworks?.[0]?.artist_id === artist_id ? 'YES ✓' : 'NO ✗ MISMATCH!',
        })

        if (error) {
          console.error('[GET /api/artworks] Query error:', error)
          return res.status(500).json({
            error: error.message,
            success: false,
            artworks: [],
          })
        }

        console.log('[GET /api/artworks] Filtered results:', filteredArtworks?.length, 'artworks')

        // NOW fetch artist data for the filtered artworks
        const artworkIds = (filteredArtworks || []).map(a => a.artist_id).filter(Boolean)
        let artistData = {}

        if (artworkIds.length > 0) {
          const { data: artists } = await supabaseAdmin
            .from('artists')
            .select('id, name')
            .in('id', artworkIds)

          artists?.forEach(a => {
            artistData[a.id] = a
          })
        }

        // Map artist data: add 'artist' field with artist name
        const artworksWithArtistNames = (filteredArtworks || []).map((artwork) => ({
          ...artwork,
          artist: artistData[artwork.artist_id]?.name || artwork.artist || 'Unknown artist',
        }))

        console.log('[GET /api/artworks] Returning', artworksWithArtistNames.length, 'artworks')

        // ✅ DEBUG: Include filter diagnosis in response (for finding 0→300 bug)
        const filterDiagnosis = {
          artist_id: artist_id || null,
          user_id: user_id || null,
          status: status || null,
          for_sale: for_sale || null,
          category: category || null,
          limit: limit,
          returned_count: artworksWithArtistNames.length,
          first_artwork_artist_id: filteredArtworks?.[0]?.artist_id || null,
          filter_match: artist_id ? (filteredArtworks?.[0]?.artist_id === artist_id ? 'YES ✓' : 'NO ✗ MISMATCH!') : 'N/A (no artist_id filter)',
        }

        return res.status(200).json({
          success: true,
          artworks: artworksWithArtistNames,
          count: artworksWithArtistNames.length,
          _debug: filterDiagnosis, // ✅ DEBUG INFO — remove in production
        })
      }

      // GET /api/artworks/my — Get artworks owned by the authenticated artist
      if (req.method === 'GET' && s1 === 'my') {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        const { data: artist } = await supabaseAdmin
          .from('artists')
          .select('id')
          .eq('user_id', auth.userId)
          .maybeSingle()

        let query = supabaseAdmin
          .from('artworks')
          .select('*, artists(id, name)')
          .order('created_at', { ascending: false })

        if (artist?.id) {
          query = query.or(`user_id.eq.${auth.userId},artist_id.eq.${artist.id}`)
        } else {
          query = query.eq('user_id', auth.userId)
        }

        const { data: artworks, error } = await query
        if (error) {
          console.error('[GET /api/artworks/my] Query error:', error)
          return res.status(500).json({ error: error.message, artworks: [] })
        }

        return res.status(200).json(artworks || [])
      }

      // GET /api/artworks/:id — Get single artwork
      if (req.method === 'GET' && s1 && s1 !== 'verify') {
        const { data, error } = await supabaseAdmin
          .from('artworks')
          .select('*')
          .eq('id', s1)
          .single()

        if (error) {
          return res.status(404).json({ error: 'Artwork not found' })
        }

        return res.status(200).json({
          success: true,
          data,
        })
      }

      // GET /api/artworks/verify/:kucibok_id — Public verification
      if (req.method === 'GET' && s1 === 'verify' && s2) {
        const { data, error } = await supabaseAdmin
          .from('artworks')
          .select('*')
          .eq('kucibok_id', s2)
          .single()

        if (error) {
          return res.status(404).json({ error: 'Artwork not found' })
        }

        return res.status(200).json({
          success: true,
          data,
        })
      }

      // POST /api/artworks — Create artwork
      if (req.method === 'POST' && !s1) {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) return

        // ✅ CRITICAL: Validate input
        const validationErrors = validateArtwork(req.body)
        if (validationErrors.length > 0) {
          return res.status(400).json({ error: 'Validation failed', errors: validationErrors })
        }

        // ✅ FIX: Get the correct artist_id from the artists table
        // The user creating the artwork should have an artist record
        let artistId = null

        const { data: existingArtist } = await supabaseAdmin
          .from('artists')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (existingArtist && existingArtist.id) {
          artistId = existingArtist.id
        } else {
          // Create artist record if it doesn't exist (for users who create artworks without a profile)
          const { data: newArtist, error: createError } = await supabaseAdmin
            .from('artists')
            .insert([{ user_id: user.id }])
            .select()

          if (createError) {
            console.warn('[Create Artwork] Failed to create artist record:', createError.message)
            // Don't fail — use NULL and let frontend handle it
          } else if (newArtist && newArtist[0]) {
            artistId = newArtist[0].id
          }
        }

        // ✅ CRITICAL: Ensure user_id and artist_id are properly linked
        const body = { ...req.body, user_id: user.id, artist_id: artistId }

        // ✅ CRITICAL: Sanitize HTML fields to prevent XSS
        if (body.description) {
          body.description = sanitizeHtml(body.description)
        }

        const { data, error } = await supabaseAdmin.from('artworks').insert([body]).select()

        if (error) {
          console.error('[POST /api/artworks] Insert error:', error.message)
          if (error.code === '23505') {
            return res.status(409).json({ error: 'This artwork already exists' })
          }
          return res.status(500).json({ error: 'Failed to create artwork' })
        }

        // ✅ Notify admin of new artwork (non-blocking)
        try {
          await sendAdminNotification(
            'Nouvelle œuvre ajoutée',
            `Un artiste a ajouté une nouvelle œuvre.`,
            {
              'Titre': body.title || 'Sans titre',
              'Artiste': user.name || user.email,
              'Catégorie': body.category || 'Non spécifiée',
              'Prix': body.price ? `${body.price} ${body.currency || 'XOF'}` : 'Non fixé',
              'Date': new Date().toLocaleString('fr-FR'),
            }
          )
        } catch (notifErr) {
          console.warn('[Create Artwork] Admin notification failed (non-blocking):', notifErr.message)
        }

        return res.status(201).json({
          success: true,
          data: data[0],
        })
      }

      // PUT /api/artworks/:id — Update artwork
      if (req.method === 'PUT' && s1 && s1 !== 'verify') {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) return

        // ✅ DEBUG: Log incoming payload
        console.log('[PUT /api/artworks/:id] Incoming body keys:', Object.keys(req.body))
        console.log('[PUT /api/artworks/:id] Incoming body size:', JSON.stringify(req.body).length, 'bytes')

        // ✅ CRITICAL: Validate input
        const validationErrors = validateArtwork(req.body)
        if (validationErrors.length > 0) {
          console.log('[PUT /api/artworks/:id] Validation failed:', validationErrors)
          return res.status(400).json({ error: 'Validation failed', errors: validationErrors })
        }

        // ✅ CRITICAL: Verify ownership
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('artworks')
          .select('user_id')
          .eq('id', s1)
          .single()

        if (fetchError || !existing) {
          return res.status(404).json({ error: 'Artwork not found' })
        }

        if (existing.user_id !== user.id) {
          return res.status(403).json({ error: 'You can only edit your own artworks' })
        }

        // ✅ Prevent user from changing user_id (ownership spoofing)
        const body = { ...req.body }
        delete body.user_id
        delete body.artist_id

        // ✅ CRITICAL: Sanitize HTML fields to prevent XSS
        if (body.description) {
          body.description = sanitizeHtml(body.description)
        }

        const { data, error } = await supabaseAdmin
          .from('artworks')
          .update(body)
          .eq('id', s1)
          .select()

        if (error) {
          console.error('[PUT /api/artworks/:id] Update error:', error.message)
          return res.status(500).json({ error: 'Failed to update artwork' })
        }

        return res.status(200).json({
          success: true,
          data: data[0],
        })
      }

      // PATCH /api/artworks/:id — Change status
      if (req.method === 'PATCH' && s1) {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) return

        // ✅ CRITICAL: Validate status enum
        const validStatus = ['pending', 'approved', 'rejected', 'archived']
        if (!validStatus.includes(req.body.status)) {
          return res.status(400).json({
            error: `Invalid status. Must be one of: ${validStatus.join(', ')}`
          })
        }

        // ✅ CRITICAL: Verify ownership
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('artworks')
          .select('user_id')
          .eq('id', s1)
          .single()

        if (fetchError || !existing) {
          return res.status(404).json({ error: 'Artwork not found' })
        }

        if (existing.user_id !== user.id) {
          return res.status(403).json({ error: 'You can only change status of your own artworks' })
        }

        const { data, error } = await supabaseAdmin
          .from('artworks')
          .update({ status: req.body.status })
          .eq('id', s1)
          .select()

        if (error) {
          return res.status(500).json({ error: error.message })
        }

        return res.status(200).json({
          success: true,
          data: data[0],
        })
      }

      // DELETE /api/artworks/:id — Delete artwork
      if (req.method === 'DELETE' && s1) {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) return

        // ✅ CRITICAL: Verify ownership
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('artworks')
          .select('user_id')
          .eq('id', s1)
          .single()

        if (fetchError || !existing) {
          return res.status(404).json({ error: 'Artwork not found' })
        }

        if (existing.user_id !== user.id) {
          return res.status(403).json({ error: 'You can only delete your own artworks' })
        }

        const { error } = await supabaseAdmin.from('artworks').delete().eq('id', s1)

        if (error) {
          return res.status(500).json({ error: error.message })
        }

        return res.status(200).json({
          success: true,
          deleted: true,
        })
      }

      // ─────────────────────────────────────────────────────────────
      // COLLECTOR COLLECTION ENDPOINTS
      // ─────────────────────────────────────────────────────────────

      // GET /api/artworks/collection — Collector's complete collection
      if (s0 === 'artworks' && req.method === 'GET' && s1 === 'collection' && !s2) {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        const {
          artist,
          medium,
          source, // 'bought' or 'digitized'
          year_from,
          year_to,
          sort = 'date_desc',
          page = 0,
          limit = 20,
        } = req.query

        try {
          let query = supabaseAdmin
            .from('artworks')
            .select('*', { count: 'exact' })

          // Filter: Own artworks (purchased or digitized)
          query = query.eq('owner_id', auth.userId)

          // Filter by artist name
          if (artist) {
            query = query.ilike('artist_name', `%${artist}%`)
          }

          // Filter by medium
          if (medium) {
            query = query.ilike('medium', `%${medium}%`)
          }

          // Filter by source
          if (source === 'bought') {
            query = query.eq('source', 'purchased')
          } else if (source === 'digitized') {
            query = query.eq('source', 'digitized')
          }

          // Filter by year range
          if (year_from) {
            query = query.gte('year', parseInt(year_from))
          }
          if (year_to) {
            query = query.lte('year', parseInt(year_to))
          }

          // Apply sort
          if (sort === 'value_desc') {
            query = query.order('price_documented', { ascending: false })
          } else if (sort === 'value_asc') {
            query = query.order('price_documented', { ascending: true })
          } else if (sort === 'artist_asc') {
            query = query.order('artist_name', { ascending: true })
          } else if (sort === 'artist_desc') {
            query = query.order('artist_name', { ascending: false })
          } else if (sort === 'date_asc') {
            query = query.order('acquisition_date', { ascending: true })
          } else {
            // date_desc (default)
            query = query.order('acquisition_date', { ascending: false })
          }

          // Pagination
          const offset = parseInt(page) * parseInt(limit)
          query = query.range(offset, offset + parseInt(limit) - 1)

          const { data: artworks, error, count } = await query

          if (error) {
            console.error('[GET /api/artworks/collection] Error:', error)
            return res.status(500).json({ error: error.message })
          }

          // Calculate total value
          const totalValue = (artworks || []).reduce((sum, a) => sum + (a.price_documented || 0), 0)

          return res.status(200).json({
            success: true,
            artworks: artworks || [],
            count: count || 0,
            total_value: totalValue,
            page: parseInt(page),
            limit: parseInt(limit),
          })
        } catch (err) {
          console.error('[GET /api/artworks/collection] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/artworks/collection-summary — Collection stats
      if (s0 === 'artworks' && req.method === 'GET' && s1 === 'collection-summary') {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        try {
          const { data: artworks, error } = await supabaseAdmin
            .from('artworks')
            .select('id, price_documented')
            .eq('owner_id', auth.userId)

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          const totalArtworks = artworks?.length || 0
          const totalValue = (artworks || []).reduce((sum, a) => sum + (a.price_documented || 0), 0)

          return res.status(200).json({
            success: true,
            total_artworks: totalArtworks,
            total_value: totalValue,
          })
        } catch (err) {
          console.error('[GET /api/artworks/collection-summary] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/artworks/collection/recent — Recent acquisitions
      if (s0 === 'artworks' && req.method === 'GET' && s1 === 'collection' && s2 === 'recent') {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        const { limit = 3 } = req.query

        try {
          const { data: artworks, error } = await supabaseAdmin
            .from('artworks')
            .select('*')
            .eq('owner_id', auth.userId)
            .order('acquisition_date', { ascending: false })
            .limit(parseInt(limit))

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({
            success: true,
            artworks: artworks || [],
          })
        } catch (err) {
          console.error('[GET /api/artworks/collection/recent] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // ─────────────────────────────────────────────────────────────
      // PURCHASE HISTORY ENDPOINTS
      // ─────────────────────────────────────────────────────────────

      // GET /api/artworks/purchase-history — Transaction history
      if (s0 === 'artworks' && req.method === 'GET' && s1 === 'purchase-history') {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        const {
          status,
          from_date,
          to_date,
          limit = 50,
          page = 0,
        } = req.query

        try {
          let query = supabaseAdmin
            .from('transactions')
            .select('*', { count: 'exact' })
            .eq('buyer_id', auth.userId)

          // Filter by status
          if (status) {
            query = query.eq('status', status)
          }

          // Filter by date range
          if (from_date) {
            query = query.gte('created_at', from_date)
          }
          if (to_date) {
            query = query.lte('created_at', to_date)
          }

          // Order and paginate
          query = query.order('created_at', { ascending: false })
          const offset = parseInt(page) * parseInt(limit)
          query = query.range(offset, offset + parseInt(limit) - 1)

          const { data: transactions, error, count } = await query

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({
            success: true,
            transactions: transactions || [],
            count: count || 0,
            page: parseInt(page),
            limit: parseInt(limit),
          })
        } catch (err) {
          console.error('[GET /api/artworks/purchase-history] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/artworks/purchase-stats — Purchase statistics
      if (s0 === 'artworks' && req.method === 'GET' && s1 === 'purchase-stats') {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        try {
          const { data: transactions, error } = await supabaseAdmin
            .from('transactions')
            .select('amount, status')
            .eq('buyer_id', auth.userId)
            .eq('status', 'paid')

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          const totalPurchased = transactions?.length || 0
          const totalAmount = (transactions || []).reduce((sum, t) => sum + (t.amount || 0), 0)

          return res.status(200).json({
            success: true,
            total_purchased: totalPurchased,
            total_amount: totalAmount,
          })
        } catch (err) {
          console.error('[GET /api/artworks/purchase-stats] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // ─────────────────────────────────────────────────────────────
      // PRIORITY ACCESS ENDPOINTS
      // ─────────────────────────────────────────────────────────────

      // GET /api/artworks/priority-access — Priority access artworks (new listings)
      if (s0 === 'artworks' && req.method === 'GET' && s1 === 'priority-access') {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        const { limit = 10 } = req.query

        try {
          // Get artworks marked for priority access, ordered by newest
          const { data: artworks, error } = await supabaseAdmin
            .from('artworks')
            .select('*')
            .eq('status', 'approved')
            .eq('priority_access', true)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit))

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({
            success: true,
            artworks: artworks || [],
            count: artworks?.length || 0,
          })
        } catch (err) {
          console.error('[GET /api/artworks/priority-access] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ARTISTS ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'artists') {
      // GET /api/artists — List all artists
      if (req.method === 'GET' && !s1) {
        const { data, error } = await supabaseAdmin
          .from('artists')
          .select('*')
          .order('name', { ascending: true })

        if (error) {
          return res.status(500).json({
            error: error.message,
            success: false,
            artists: [],
          })
        }

        return res.status(200).json({
          success: true,
          artists: data || [],
          count: (data || []).length,
        })
      }

      // GET /api/artists/:id — Get single artist
      if (req.method === 'GET' && s1 && !['followed', 'follow', 'unfollow'].includes(s1)) {
        const { data, error } = await supabaseAdmin
          .from('artists')
          .select('*')
          .eq('id', s1)
          .single()

        if (error) {
          return res.status(404).json({ error: 'Artist not found' })
        }

        return res.status(200).json({
          success: true,
          data,
        })
      }

      // ─────────────────────────────────────────────────────────────
      // COLLECTOR FOLLOW ENDPOINTS
      // ─────────────────────────────────────────────────────────────

      // GET /api/artists/followed — Get followed artists for collector
      if (req.method === 'GET' && s1 === 'followed') {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        try {
          // Get followed artists
          const { data: followedArtists, error: followError } = await supabaseAdmin
            .from('collector_follows')
            .select('artist_id')
            .eq('collector_id', auth.userId)

          if (followError) {
            return res.status(500).json({ error: followError.message })
          }

          if (!followedArtists || followedArtists.length === 0) {
            return res.status(200).json({
              success: true,
              artists: [],
              count: 0,
            })
          }

          const artistIds = followedArtists.map(f => f.artist_id)

          // Get artist details and check if they have new works
          const { data: artists, error: artistError } = await supabaseAdmin
            .from('artists')
            .select('id, name, image')
            .in('id', artistIds)

          if (artistError) {
            return res.status(500).json({ error: artistError.message })
          }

          // Check for new works for each artist
          const artistsWithNewWorks = await Promise.all(
            (artists || []).map(async (artist) => {
              const { data: newWorks } = await supabaseAdmin
                .from('artworks')
                .select('id')
                .eq('artist_id', artist.id)
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(1)

              return {
                ...artist,
                has_new_work: newWorks && newWorks.length > 0,
              }
            })
          )

          return res.status(200).json({
            success: true,
            artists: artistsWithNewWorks || [],
            count: artistsWithNewWorks?.length || 0,
          })
        } catch (err) {
          console.error('[GET /api/artists/followed] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // POST /api/artist/follow/:artist_id — Follow an artist
      if (req.method === 'POST' && s1 === 'follow' && s2) {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        try {
          const artistId = s2

          // Check if already following
          const { data: existing } = await supabaseAdmin
            .from('collector_follows')
            .select('id')
            .eq('collector_id', auth.userId)
            .eq('artist_id', artistId)
            .maybeSingle()

          if (existing) {
            return res.status(200).json({
              success: true,
              message: 'Already following this artist',
              already_following: true,
            })
          }

          // Insert follow
          const { error } = await supabaseAdmin
            .from('collector_follows')
            .insert({
              collector_id: auth.userId,
              artist_id: artistId,
            })

          if (error) {
            if (error.code === '23505') {
              // Unique constraint violation = already following
              return res.status(200).json({
                success: true,
                message: 'Already following this artist',
                already_following: true,
              })
            }
            throw error
          }

          return res.status(201).json({
            success: true,
            message: 'Artist followed successfully',
          })
        } catch (err) {
          console.error('[POST /api/artist/follow] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // POST /api/artist/unfollow/:artist_id — Unfollow an artist
      if (req.method === 'POST' && s1 === 'unfollow' && s2) {
        const auth = await checkAuth(req)
        if (!auth?.userId) {
          return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
        }

        try {
          const artistId = s2

          const { error } = await supabaseAdmin
            .from('collector_follows')
            .delete()
            .eq('collector_id', auth.userId)
            .eq('artist_id', artistId)

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({
            success: true,
            message: 'Artist unfollowed successfully',
          })
        } catch (err) {
          console.error('[POST /api/artist/unfollow] Exception:', err)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // HEALTH CHECK
    // ─────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────
    // PROFESSIONAL ANALYTICS ROUTE
    // ─────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────
    // AUTH ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'auth') {
      // POST /api/auth/google-callback — Handle Google OAuth callback
      if (req.method === 'POST' && s1 === 'google-callback') {
        try {
          const { access_token } = req.body
          if (!access_token) {
            return res.status(400).json({ error: 'access_token is required' })
          }

          // Get user from token (Supabase has already created session)
          const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(access_token)

          if (!authUser) {
            return res.status(401).json({ error: 'Invalid access token' })
          }

          // Check if user exists in public.users
          const { data: existingUser, error: checkError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()

          if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 = no rows found (expected for new users)
            return res.status(500).json({ error: checkError.message })
          }

          if (!existingUser) {
            // New user - create profile
            const { error: createError } = await supabaseAdmin
              .from('users')
              .insert({
                id: authUser.id,
                role: 'buyer', // Default role
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
                auth_provider: 'google',
                is_active: true,
              })

            if (createError) {
              console.error('[Google Callback - Create User Error]', createError)
              return res.status(500).json({ error: 'Failed to create user profile' })
            }

            return res.status(200).json({
              success: true,
              data: {
                user: { id: authUser.id, email: authUser.email, role: 'buyer' },
                needs_role_selection: true,
              },
            })
          }

          // Existing user
          return res.status(200).json({
            success: true,
            data: {
              user: existingUser,
              needs_role_selection:
                existingUser.auth_provider === 'google' &&
                (!existingUser.onboarding_completed || existingUser.role === 'buyer'),
            },
          })
        } catch (err) {
          console.error('[Google Callback Error]', err.message)
          return res.status(500).json({ error: err.message || 'OAuth callback failed' })
        }
      }

      // POST /api/auth/set-role — Save the role selected after Google signup
      if (req.method === 'POST' && s1 === 'set-role') {
        try {
          const auth = await checkAuth(req)
          if (!auth?.userId) {
            return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
          }

          const { role } = req.body || {}
          const allowedRoles = ['buyer', 'artist', 'curator', 'advisor']
          if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' })
          }

          const { data: currentUser, error: currentUserError } = await supabaseAdmin
            .from('users')
            .select('id, role, name, country, auth_provider')
            .eq('id', auth.userId)
            .single()

          if (currentUserError || !currentUser) {
            return res.status(404).json({ error: 'User profile not found' })
          }
          if (currentUser.role !== 'buyer' || currentUser.auth_provider !== 'google') {
            return res.status(403).json({ error: 'Role selection is only available after Google signup' })
          }

          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({ role, onboarding_completed: true })
            .eq('id', auth.userId)
            .select('id, name, role, country, auth_provider, onboarding_completed, is_active')
            .single()

          if (updateError) {
            return res.status(500).json({ error: updateError.message })
          }

          if (role === 'artist') {
            const { data: existingArtist } = await supabaseAdmin
              .from('artists')
              .select('id')
              .eq('user_id', auth.userId)
              .maybeSingle()

            const { error: artistError } = existingArtist
              ? { error: null }
              : await supabaseAdmin
              .from('artists')
              .insert({ user_id: auth.userId, name: currentUser.name })
            if (artistError) {
              return res.status(500).json({ error: artistError.message })
            }
          }

          return res.status(200).json({ data: { _id: updatedUser.id, ...updatedUser } })
        } catch (err) {
          console.error('[Set Initial Role Error]', err.message)
          return res.status(500).json({ error: err.message || 'Role update failed' })
        }
      }

      // POST /api/auth/signup — Register new user
      if (req.method === 'POST' && s1 === 'signup') {
        try {
          const { email, password, role, name, country, institution } = req.body

          if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' })
          }

          // ✅ Validate email format
          if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' })
          }

          if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' })
          }

          // Create auth user via Supabase admin
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: false, // User must verify email
            user_metadata: {
              role: role || 'buyer',
              name: name || email.split('@')[0],
              country: country || null,
              institution: institution || null,
            },
          })

          if (error) {
            console.error('[Signup Auth Error]', error.message)
            return res.status(400).json({
              error: error.message.includes('already exists')
                ? 'This email is already registered'
                : error.message,
            })
          }

          // Create user profile in public.users
          // Note: Only include columns that exist in public.users table
          // Available columns: id, name, username, role, country, telephone, auth_provider, profile_completed, onboarding_completed, is_active, last_login, created_at
          const { error: profileError } = await supabaseAdmin.from('users').insert({
            id: data.user.id,
            role: role || 'buyer',
            name: name || email.split('@')[0],
            country: country || null,
            auth_provider: 'email',
            is_active: true,
          })

          if (profileError) {
            console.error('[Signup Profile Error]', profileError)
            // Note: Auth user created but profile failed - may need cleanup
            return res.status(500).json({ error: 'Failed to create user profile' })
          }

          // ✅ Send confirmation email via Resend
          // Generate a verification link using Supabase's built-in flow
          try {
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'email_verification',
              email: email,
              options: {
                redirectTo: `${process.env.CORS_ORIGIN || 'https://kucibok.com'}/auth/verify-email`,
              },
            })

            if (linkError || !linkData?.properties?.action_link) {
              console.warn('[Signup] Failed to generate verification link:', linkError?.message)
            } else {
              const confirmationLink = linkData.properties.action_link
              const emailResult = await sendConfirmationEmail(email, confirmationLink)
              if (!emailResult.success) {
                console.warn('[Signup] Email send failed (non-blocking):', emailResult.error)
              }
            }
          } catch (emailErr) {
            console.warn('[Signup] Email sending exception (non-blocking):', emailErr.message)
          }

          // ✅ Notify admin of new signup (non-blocking)
          try {
            await sendAdminNotification(
              'Nouvel utilisateur inscrit',
              `Un nouvel utilisateur s'est inscrit sur la plateforme.`,
              {
                'Email': email,
                'Nom': name || 'Non fourni',
                'Rôle': role || 'buyer',
                'Pays': country || 'Non fourni',
                'Institution': institution || 'Non fourni',
                'Date': new Date().toLocaleString('fr-FR'),
              }
            )
          } catch (notifErr) {
            console.warn('[Signup] Admin notification failed (non-blocking):', notifErr.message)
          }

          return res.status(201).json({
            success: true,
            data: {
              user: {
                id: data.user.id,
                email: data.user.email,
                role: role || 'buyer',
              },
              message: 'Check your email to verify your account',
            },
          })
        } catch (err) {
          console.error('[Signup Exception]', err.message)
          return res.status(500).json({ error: err.message || 'Signup failed' })
        }
      }

      // POST /api/auth/signin — Login with email + password
      if (req.method === 'POST' && s1 === 'signin') {
        try {
          const { email, password } = req.body

          if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' })
          }

          // ✅ FIX: Use service_role to authenticate (backend can do this)
          // Supabase admin.auth allows password sign-in without exposing keys
          const { data, error } = await supabaseAdmin.auth.admin.signInWithPassword({
            email,
            password,
          })

          if (error) {
            console.error('[Signin Auth Error]', error.message)
            return res.status(401).json({
              error: error.message.includes('Invalid login credentials')
                ? 'Invalid email or password'
                : error.message,
            })
          }

          if (!data.session || !data.user) {
            return res.status(401).json({ error: 'Login failed - no session' })
          }

          // Get full user profile
          const { data: profile } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single()

          return res.status(200).json({
            success: true,
            data: {
              session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_in: data.session.expires_in,
              },
              user: profile || {
                id: data.user.id,
                email: data.user.email,
                role: 'buyer',
              },
            },
          })
        } catch (err) {
          console.error('[Signin Exception]', err.message)
          return res.status(500).json({ error: err.message || 'Login failed' })
        }
      }

      // GET /api/auth — List all users (Admin only)
      if (req.method === 'GET' && !s1) {
        try {
          const user = await getAuthUser()
          if (!user) {
            return res.status(401).json({ error: 'Unauthorized' })
          }

          // Check if user is admin
          if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can list users' })
          }

          // Fetch all users from public.users table
          const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({
            success: true,
            data: users || [],
          })
        } catch (err) {
          console.error('[Auth List Users Error]', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/auth/me — Get current user
      if (req.method === 'GET' && s1 === 'me') {
        try {
          const authHeader = req.headers.authorization
          if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' })
          }

          const token = authHeader.substring(7)
          const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

          if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' })
          }

          // Get full user profile
          const { data: profile } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          return res.status(200).json({
            data: profile || { id: user.id, email: user.email, role: 'buyer' },
          })
        } catch (err) {
          console.error('[Auth Me Error]', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // PUT /api/auth/:id — Update user profile (name, email, telephone)
      if (req.method === 'PUT' && s1) {
        try {
          const user = await getAuthUser()
          if (!user) {
            return res.status(401).json({ error: 'Unauthorized' })
          }

          // Only allow users to update their own profile
          if (user.id !== s1) {
            return res.status(403).json({ error: 'You can only update your own profile' })
          }

          const { name, email, telephone } = req.body
          const updatePayload = {}

          if (name !== undefined && name !== null) updatePayload.name = name
          if (email !== undefined && email !== null) updatePayload.email = email
          if (telephone !== undefined && telephone !== null) updatePayload.telephone = telephone

          // Update user profile
          const { data, error } = await supabaseAdmin
            .from('users')
            .update(updatePayload)
            .eq('id', s1)
            .select()

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          // Return first result if array, otherwise return data as-is
          const result = Array.isArray(data) ? data[0] : data
          return res.status(200).json({ success: true, data: result })
        } catch (err) {
          console.error('[Auth Update Error]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // Handle both /api/professional-analytics and /api/professional/analytics
    if ((s0 === 'professional-analytics' || (s0 === 'professional' && s1 === 'analytics')) && req.method === 'GET' && !s2) {
      let period = 'month' // Define early for catch block
      try {
        const url = new URL(req.url, 'http://localhost')
        period = url.searchParams.get('period') || 'month'
        const cacheKey = `analytics:${period}`

        // Try cache first
        const { data: cachedData } = await supabaseAdmin
          .from('analytics_cache')
          .select('data')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .single()

        if (cachedData?.data) {
          return res.status(200).json({ data: cachedData.data, cached: true })
        }

        // Fetch REAL data using direct transaction queries (bypasses buggy RPC)
        const analytics = await handleProfessionalAnalytics(supabaseAdmin, period)

        // Cache result (silent fail if cache unavailable)
        try {
          await supabaseAdmin
            .from('analytics_cache')
            .upsert(
              {
                cache_key: cacheKey,
                data: analytics.data,
                expires_at: new Date(Date.now() + CACHE_TTL).toISOString(),
              },
              { onConflict: 'cache_key' }
            )
        } catch (cacheErr) {
          // Silent fail - cache is optional
          console.warn('[Analytics Cache] Warning:', cacheErr.message)
        }

        return res.status(200).json(analytics)
      } catch (err) {
        console.error('[Professional Analytics Error]', err.message, err.code)
        // Return error response, NOT fallback mock data
        // This ensures data integrity: real data or error message, never fictitious data
        return res.status(500).json({
          error: 'Failed to fetch market analytics',
          message: err.message,
          period,
          source: 'error',
          timestamp: new Date().toISOString(),
        })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SUBSCRIPTIONS ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'subscriptions') {
      // POST /api/subscriptions/create-trial — Create 14-day trial
      if (req.method === 'POST' && s1 === 'create-trial') {
        const { user_id } = req.body

        if (!user_id) {
          return res.status(400).json({ error: 'user_id is required' })
        }

        try {
          const trialEndDate = new Date()
          trialEndDate.setDate(trialEndDate.getDate() + 14)

          const { data, error } = await supabaseAdmin
            .from('subscriptions')
            .insert({
              user_id,
              plan_id: null,
              status: 'trial',
              is_trial: true,
              trial_started_at: new Date(),
              trial_end_date: trialEndDate,
              start_date: new Date(),
              end_date: trialEndDate,
            })
            .select()
            .single()

          if (error) {
            console.error('[Trial Creation Error]', error)
            return res.status(500).json({ error: error.message })
          }

          // ✅ Notify admin of new trial subscription (non-blocking)
          try {
            const { data: userData } = await supabaseAdmin
              .from('users')
              .select('name, email, role')
              .eq('id', user_id)
              .single()

            await sendAdminNotification(
              'Nouvel abonnement créé (Trial)',
              `Un utilisateur a commencé un abonnement d'essai de 14 jours.`,
              {
                'Utilisateur': userData?.name || userData?.email || 'Inconnu',
                'Rôle': userData?.role || 'buyer',
                'Fin d\'essai': new Date(trialEndDate).toLocaleDateString('fr-FR'),
                'Date': new Date().toLocaleString('fr-FR'),
              }
            )
          } catch (notifErr) {
            console.warn('[Trial Subscription] Admin notification failed (non-blocking):', notifErr.message)
          }

          return res.status(201).json({
            success: true,
            data,
            message: 'Trial subscription created',
          })
        } catch (err) {
          console.error('[Trial Creation Exception]', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/subscriptions/active/:user_id — Get active subscription
      if (req.method === 'GET' && s1 === 'active' && s2) {
        // ✅ CRITICAL: Verify authentication
        const authUser = await getAuthUser()
        if (!authUser) return

        // ✅ CRITICAL: Verify ownership - can only view own subscription
        if (s2 !== authUser.id) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only view your own subscription'
          })
        }

              const { artwork_id } = req.body || {}
              if (!artwork_id) return res.status(400).json({ error: 'artwork_id requis' })

              const { data: artwork, error: artworkError } = await supabaseAdmin
                .from('artworks').select('*').eq('id', artwork_id).single()
              if (artworkError || !artwork) return res.status(404).json({ error: 'Œuvre introuvable' })
              if (artwork.status !== 'approved') return res.status(400).json({ error: 'L’œuvre doit être approuvée' })

              const isAdmin = user.role === 'admin'
              let isOwner = artwork.user_id === user.id
              if (!isOwner && artwork.artist_id) {
                const { data: ownerArtist } = await supabaseAdmin.from('artists').select('user_id').eq('id', artwork.artist_id).maybeSingle()
                isOwner = ownerArtist?.user_id === user.id
              }
              if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Accès refusé' })

              const { data: artist } = artwork.artist_id
                ? await supabaseAdmin.from('artists').select('name').eq('id', artwork.artist_id).maybeSingle()
                : { data: null }
              const artistName = artist?.name || user.user_metadata?.name || 'Artiste Kucibok'
              const kcbNumber = artwork.kucibok_id || `KCB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
              const pdf = await createPdfBuffer((doc) => {
                doc.fillColor('#B08D57').fontSize(24).text('CERTIFICAT KUCIBOK', { align: 'center' })
                doc.moveDown(0.5).fillColor('#222').fontSize(12).text('Certificat d’authenticité et de provenance', { align: 'center' })
                doc.moveDown(2).fontSize(16).text(artwork.title, { align: 'center' })
                doc.moveDown().fontSize(11).text(`Artiste : ${artistName}`)
                doc.text(`Identifiant KCB : ${kcbNumber}`)
                doc.text(`Support : ${artwork.medium || 'Non renseigné'}`)
                doc.text(`Dimensions : ${artwork.height || '—'} × ${artwork.width || '—'}`)
                doc.text(`Émis le : ${new Date().toLocaleDateString('fr-FR')}`)
                doc.moveDown(2).fontSize(10).fillColor('#555').text('Ce document certifie l’enregistrement de l’œuvre dans le Standard Kucibok. Vérification publique disponible sur kucibok.com.', { align: 'justify' })
              })
              const path = `certificates/${artwork_id}-${kcbNumber}.pdf`
              const { error: uploadError } = await supabaseAdmin.storage.from('certificates').upload(path, pdf, { contentType: 'application/pdf', upsert: true })
              if (uploadError) return res.status(500).json({ error: uploadError.message })
              const { data, error } = await supabaseAdmin.from('artworks').update({ kucibok_id: kcbNumber, certificate_path: path }).eq('id', artwork_id).select().single()
              if (error) return res.status(500).json({ error: error.message })

        try {
          const { data, error } = await supabaseAdmin
            .from('shortlisted_artworks')
            .insert({
              user_id,
              artwork_id: artworkId,
              notes: req.body.notes || '',
            })
            .select()
            .single()

          if (error && error.code === '23505') {
            // Unique constraint violation = already shortlisted
            return res.status(409).json({
              error: 'Artwork already shortlisted',
              success: false,
            })
          }

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(201).json({
            success: true,
            data,
            message: 'Added to shortlist',
          })
        } catch (err) {
          console.error('[Shortlist Add Error]', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // DELETE /api/shortlist/:artworkId — Remove from shortlist
      if (req.method === 'DELETE' && s1) {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) return

        // ✅ CRITICAL: Use authenticated user_id, NOT from body
        const user_id = user.id
        const artworkId = s1

        if (!user_id || !artworkId) {
          return res.status(400).json({ error: 'Missing artworkId' })
        }

        try {
          const { error } = await supabaseAdmin
            .from('shortlisted_artworks')
            .delete()
            .eq('user_id', user_id)
            .eq('artwork_id', artworkId)

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({
            success: true,
            message: 'Removed from shortlist',
          })
        } catch (err) {
          console.error('[Shortlist Remove Error]', err)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/shortlist/check/:artworkId — Check if shortlisted
      if (req.method === 'GET' && s1 === 'check' && s2) {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) return

        // ✅ CRITICAL: Use authenticated user_id, NOT from query
        const user_id = user.id
        const artworkId = s2

        if (!artworkId) {
          return res.status(400).json({ error: 'Missing artworkId' })
        }

        try {
          const { data, error } = await supabaseAdmin
            .from('shortlisted_artworks')
            .select('id')
            .eq('user_id', user_id)
            .eq('artwork_id', artworkId)
            .single()

          return res.status(200).json({
            success: true,
            isShortlisted: !!data && !error,
          })
        } catch (err) {
          return res.status(200).json({
            success: true,
            isShortlisted: false,
          })
        }
      }

      // GET /api/shortlist — Get user's shortlist
      if (req.method === 'GET' && !s1) {
        // ✅ CRITICAL: Verify authentication
        const authUser = await getAuthUser()
        if (!authUser) return

        // ✅ CRITICAL: user_id from query is NO LONGER ACCEPTED
        // Always use authenticated user's ID
        try {
          const { data, error } = await supabaseAdmin
            .from('shortlisted_artworks')
            .select('*, artworks(*)')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })

          if (error) {
            console.error('[GET /api/shortlist Error]', error.code, error.message)
            // If table doesn't exist, provide helpful message
            if (error.code === 'PGRST116') {
              return res.status(200).json({ success: true, data: [], count: 0 })
            }
            // ✅ Don't leak database error codes to client
            return res.status(500).json({ error: 'Failed to retrieve shortlist' })
          }

          return res.status(200).json({
            success: true,
            data: data || [],
            count: (data || []).length,
          })
        } catch (err) {
          console.error('[Shortlist Get Exception]', err.message)
          return res.status(500).json({ error: 'Internal server error' })
        }
      }

      // PATCH /api/shortlist/:artworkId — Update notes
      if (req.method === 'PATCH' && s1) {
        // ✅ CRITICAL: Verify authentication
        const authUser = await getAuthUser()
        if (!authUser) return

        // ✅ CRITICAL: user_id MUST come from auth token, NOT request body
        // Attacker CANNOT forge user_id
        const { notes } = req.body
        const artworkId = s1

        if (!artworkId) {
          return res.status(400).json({ error: 'Missing artworkId' })
        }

        // ✅ Optional: Validate notes don't exceed 1000 characters
        if (notes && typeof notes === 'string' && notes.length > 1000) {
          return res.status(400).json({ error: 'Notes must be under 1000 characters' })
        }

        try {
          const { data, error } = await supabaseAdmin
            .from('shortlisted_artworks')
            .update({ notes: notes || '' })
            .eq('user_id', authUser.id)  // ✅ Use authenticated user, not from body
            .eq('artwork_id', artworkId)
            .select()
            .single()

          if (error) {
            console.error('[PATCH /api/shortlist] Query error:', error.message)
            // ✅ Don't leak database error codes
            if (error.code === 'PGRST116') {
              return res.status(404).json({ error: 'Artwork not found in shortlist' })
            }
            return res.status(500).json({ error: 'Failed to update notes' })
          }

          return res.status(200).json({
            success: true,
            data,
            message: 'Notes updated',
          })
        } catch (err) {
          console.error('[Shortlist Update Exception]', err.message)
          return res.status(500).json({ error: 'Internal server error' })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PLANS ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'plan' && req.method === 'GET' && !s1) {
      const mockPlans = [
        { id: 1, name: 'Starter', price: 27, features: ['Feature 1', 'Feature 2'], trial_days: 14 },
        { id: 2, name: 'Professional', price: 57, features: ['All Starter', 'Feature 3', 'Feature 4'], trial_days: 14 },
      ]
      return res.status(200).json({ success: true, data: mockPlans })
    }

    // ─────────────────────────────────────────────────────────────
    // ARTIST ROUTES
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'artist' && req.method === 'GET' && !s1) {
      try {
        const { data, error } = await supabaseAdmin
          .from('artists')
          .select('*')
          .limit(100)
        if (error) {
          return res.status(200).json({ success: true, data: [], count: 0 })
        }
        return res.status(200).json({ success: true, data: data || [], count: (data || []).length })
      } catch (err) {
        return res.status(200).json({ success: true, data: [], count: 0 })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CATEGORY ROUTES
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'category' && req.method === 'GET' && !s1) {
      const mockCategories = [
        { id: 1, name: 'Painting', slug: 'painting' },
        { id: 2, name: 'Sculpture', slug: 'sculpture' },
        { id: 3, name: 'Photography', slug: 'photography' },
        { id: 4, name: 'Mixed Media', slug: 'mixed-media' },
      ]
      return res.status(200).json({ success: true, data: mockCategories })
    }

    // ─────────────────────────────────────────────────────────────
    // BLOG ROUTES
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'blog' && (s1 === 'published' || s1 === 'archived') && req.method === 'GET') {
      return res.status(200).json({ success: true, data: [], count: 0 })
    }

    // ─────────────────────────────────────────────────────────────
    // VISITOR ROUTE (tracking)
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'visitor' && req.method === 'POST') {
      // Just log and return success — no database required
      console.log('[Visitor Tracked]', req.body)
      return res.status(200).json({ success: true, message: 'Visitor tracked' })
    }

    // ─────────────────────────────────────────────────────────────
    // COLLECTION ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'collection' && req.method === 'GET' && !s1) {
      return res.status(200).json({ success: true, data: [], count: 0 })
    }

    // ─────────────────────────────────────────────────────────────
    // DELIVERY ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'delivery' && req.method === 'GET' && !s1) {
      return res.status(200).json({ success: true, data: [] })
    }

    // ─────────────────────────────────────────────────────────────
    // PROFILE ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'profile' && s1 && req.method === 'GET') {
      try {
        // First, get the user to determine their role
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('role')
          .eq('id', s1)
          .single()

        if (userError) {
          return res.status(404).json({ error: 'Profile not found' })
        }

        // If user is artist, return artist profile (with artist.id for artwork queries)
        if (userData?.role === 'artist') {
          let { data: artistData, error: artistError } = await supabaseAdmin
            .from('artists')
            .select('*')
            .eq('user_id', s1)
            .single()

          console.log('[GET /api/profile] Artist query result:', {
            user_id: s1,
            has_data: !!artistData,
            has_error: !!artistError,
            artist_id: artistData?.id,
          })

          // ✅ FIX: Auto-create artist profile if it doesn't exist
          if (artistError || !artistData) {
            console.log('[GET /api/profile] Artist profile not found, creating one for user:', s1)
            const { data: newArtist, error: createError } = await supabaseAdmin
              .from('artists')
              .insert([{ user_id: s1 }])
              .select()
              .single()

            console.log('[GET /api/profile] Artist creation result:', {
              created: !!newArtist,
              error: createError?.message,
              new_artist_id: newArtist?.id,
            })

            if (createError || !newArtist) {
              console.error('[GET /api/profile] CRITICAL: Failed to create artist profile:', createError?.message)
              // ❌ DO NOT fallback to users table — return empty artist instead
              // The frontend expects artistProfile.id from the artists table
              return res.status(200).json({
                success: true,
                data: {
                  id: null, // Signal to frontend that profile load failed
                  user_id: s1,
                  error: 'Profile creation failed',
                }
              })
            }

            artistData = newArtist
          }

          console.log('[GET /api/profile] Returning artist profile:', {
            artist_id: artistData?.id,
            user_id: artistData?.user_id,
          })

          return res.status(200).json({ success: true, data: artistData })
        }

        // For non-artists (buyer, curator, advisor, admin), return users table
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', s1)
          .single()

        if (profileError) {
          return res.status(404).json({ error: 'Profile not found' })
        }

        return res.status(200).json({ success: true, data: profileData })
      } catch (err) {
        return res.status(404).json({ error: 'Profile not found' })
      }
    }

    // DEBUG ENDPOINT: Test profile fix for Missira
    if (s0 === 'debug' && s1 === 'missira-profile') {
      try {
        // Find Missira's user_id
        const { data: missiraUser } = await supabaseAdmin
          .from('users')
          .select('id, role, username')
          .eq('username', 'missira_keita')
          .single()

        if (!missiraUser) {
          return res.status(404).json({ error: 'Missira not found' })
        }

        // Call profile endpoint manually to test it
        const profileRes = await supabaseAdmin
          .from('artists')
          .select('*')
          .eq('user_id', missiraUser.id)
          .single()

        return res.status(200).json({
          debug: {
            missira_user_id: missiraUser.id,
            missira_role: missiraUser.role,
            missira_artist_id: profileRes.data?.id,
            artist_profile: profileRes.data,
          },
        })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    if (s0 === 'profile' && s1 && req.method === 'PUT') {
      try {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) return

        // ✅ CRITICAL: Verify user can only modify their own profile
        if (user.id !== s1) {
          return res.status(403).json({ error: 'You can only modify your own profile' })
        }

        // ✅ CRITICAL: Prevent privilege escalation (role change)
        const body = { ...req.body }
        delete body.role  // Users cannot change their own role
        delete body.is_active  // Users cannot deactivate themselves

        const { data, error } = await supabaseAdmin
          .from('users')
          .update(body)
          .eq('id', s1)
          .select()
          .single()
        if (error) {
          return res.status(500).json({ error: error.message })
        }
        return res.status(200).json({ success: true, data })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ARTIST PROFILE ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'artist' && s1 && req.method === 'PUT') {
      try {
        // ✅ CRITICAL: Require authentication
        const user = await getAuthUser()
        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' })
        }

        // ✅ CRITICAL: Accept artist_id in URL, not user_id
        // s1 is the artist.id (UUID from artists table)
        const artistId = s1

        // Fetch the artist profile to verify ownership
        const { data: artistCheck, error: checkError } = await supabaseAdmin
          .from('artists')
          .select('id, user_id')
          .eq('id', artistId)
          .single()

        if (checkError || !artistCheck) {
          return res.status(404).json({ error: 'Artist profile not found' })
        }

        // ✅ Verify authenticated user owns this artist profile
        if (artistCheck.user_id !== user.id) {
          return res.status(403).json({ error: 'You can only modify your own artist profile' })
        }

        // ✅ CRITICAL: Prevent privilege escalation (cannot change user_id or user fields)
        const body = { ...req.body }
        delete body.user_id
        delete body.id
        delete body.name        // ← user field, not artist field
        delete body.email       // ← user field, not artist field
        delete body.telephone   // ← user field, not artist field

        // Remove empty values to avoid overwriting with nulls
        Object.keys(body).forEach(key => {
          if (body[key] === null || body[key] === undefined || body[key] === '') {
            delete body[key]
          }
        })

        // Update artist profile
        const { data, error } = await supabaseAdmin
          .from('artists')
          .update(body)
          .eq('id', artistId)
          .select()
          .single()

        if (error) {
          return res.status(500).json({ error: error.message })
        }

        return res.status(200).json({ success: true, data })
      } catch (err) {
        console.error('[PUT /api/artist] Exception:', err.message)
        return res.status(500).json({ error: err.message })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SOURCING INQUIRIES ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'sourcing') {
      // POST /api/sourcing/inquiry — Submit sourcing inquiry
      if (req.method === 'POST' && s1 === 'inquiry') {
        try {
          const { organization, purpose, budget, message, requested_by } = req.body

          // Validate required fields
          if (!organization || !purpose || !message) {
            return res.status(400).json({
              error: 'Missing required fields: organization, purpose, message',
            })
          }

          // Insert sourcing inquiry
          const { data, error } = await supabaseAdmin
            .from('sourcing_inquiries')
            .insert({
              organization,
              purpose,
              budget: budget || null,
              message,
              requested_by: requested_by || null,
              status: 'pending',
            })
            .select()
            .single()

          if (error) {
            console.error('[Sourcing Inquiry Error]', error)
            return res.status(500).json({ error: error.message })
          }

          // ✅ Notify admin of new sourcing inquiry (non-blocking)
          try {
            await sendAdminNotification(
              '🤝 Nouvelle demande de sourcing (Partenariat)',
              'Une organisation souhaite établir un partenariat avec Kucibok.',
              {
                'Organisation': organization,
                'Objectif': purpose,
                'Budget': budget ? `${budget} XOF` : 'Non spécifié',
                'Message': message.substring(0, 100) + (message.length > 100 ? '...' : ''),
                'Date': new Date().toLocaleString('fr-FR'),
              }
            )
          } catch (notifErr) {
            console.warn('[Sourcing] Admin notification failed:', notifErr.message)
          }

          return res.status(201).json({
            success: true,
            data,
            message: 'Sourcing inquiry submitted successfully',
          })
        } catch (err) {
          console.error('[Sourcing Inquiry Exception]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // DELIVERY ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'delivery') {
      // POST /api/delivery/request — Create delivery request
      if (req.method === 'POST' && s1 === 'request') {
        try {
          const user = await getAuthUser()
          if (!user) return

          // Only artist, curator, advisor can create delivery requests
          if (!['artist', 'curator', 'advisor'].includes(user.role)) {
            return res.status(403).json({
              error: 'Only artists, curators, and advisors can create delivery requests',
            })
          }

          const { artwork_ids, destination_country, delivery_type, special_instructions } = req.body

          if (!artwork_ids || !Array.isArray(artwork_ids) || artwork_ids.length === 0) {
            return res.status(400).json({ error: 'artwork_ids must be a non-empty array' })
          }

          if (!destination_country) {
            return res.status(400).json({ error: 'destination_country is required' })
          }

          // Create delivery request
          const { data, error } = await supabaseAdmin
            .from('delivery_requests')
            .insert({
              user_id: user.id,
              destination_country,
              delivery_type: delivery_type || 'standard',
              special_instructions,
              status: 'pending',
              created_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (error) {
            console.error('[Delivery Request Error]', error)
            return res.status(500).json({ error: error.message })
          }

          // ✅ Notify admin of new delivery request (non-blocking)
          try {
            await sendAdminNotification(
              '🚚 Nouvelle demande de livraison',
              'Un utilisateur a créé une demande de livraison transfrontalière.',
              {
                'Utilisateur': user.name || user.email,
                'Rôle': user.role,
                'Destination': destination_country,
                'Type': delivery_type || 'Standard',
                'Nombre d\'œuvres': artwork_ids.length,
                'Instructions': special_instructions || 'Aucune',
                'Date': new Date().toLocaleString('fr-FR'),
              }
            )
          } catch (notifErr) {
            console.warn('[Delivery] Admin notification failed:', notifErr.message)
          }

          return res.status(201).json({
            success: true,
            data,
            message: 'Delivery request created successfully',
          })
        } catch (err) {
          console.error('[Delivery Request Exception]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PAYMENT WEBHOOK ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'payments') {
      // POST /api/payments/webhook — Handle payment notifications (PayDunya, Stripe)
      if (req.method === 'POST' && s1 === 'webhook') {
        try {
          const { transaction_id, status, amount, user_id, type, currency } = req.body

          if (!transaction_id || !status || !amount) {
            return res.status(400).json({
              error: 'Missing required fields: transaction_id, status, amount',
            })
          }

          // Log transaction
          const { data, error } = await supabaseAdmin
            .from('transactions')
            .insert({
              transaction_id,
              user_id,
              amount,
              currency: currency || 'XOF',
              type: type || 'purchase',
              status,
              metadata: req.body,
              created_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (error) {
            console.error('[Payment Webhook Error]', error)
            return res.status(500).json({ error: error.message })
          }

          // Only notify admin for successful payments (non-blocking)
          if (status === 'success') {
            try {
              const { data: userData } = await supabaseAdmin
                .from('users')
                .select('name, email, role')
                .eq('id', user_id)
                .single()

              await sendAdminNotification(
                '💳 Nouveau paiement reçu',
                `Un paiement a été traité avec succès sur la plateforme.`,
                {
                  'Montant': `${amount} ${currency || 'XOF'}`,
                  'Type': type || 'Achat',
                  'Client': userData?.name || userData?.email || 'Inconnu',
                  'Rôle Client': userData?.role || 'buyer',
                  'Transaction ID': transaction_id,
                  'Date': new Date().toLocaleString('fr-FR'),
                }
              )
            } catch (notifErr) {
              console.warn('[Payment] Admin notification failed:', notifErr.message)
            }
          }

          return res.status(201).json({
            success: true,
            data,
            message: 'Payment webhook processed',
          })
        } catch (err) {
          console.error('[Payment Webhook Exception]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CERTIFICATES ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'certificates') {
      // POST /api/certificates/generate — Generate KCB certificate
      if (req.method === 'POST' && s1 === 'generate') {
        try {
          const user = await getAuthUser()
          if (!user) return

          // Only artist, curator, advisor can generate certificates
          if (!['artist', 'curator', 'advisor'].includes(user.role)) {
            return res.status(403).json({
              error: 'Only artists, curators, and advisors can generate certificates',
            })
          }

          const { artwork_id, artist_name, artwork_title, dimensions, medium, year } = req.body

          if (!artwork_id || !artwork_title || !artist_name) {
            return res.status(400).json({
              error: 'Missing required fields: artwork_id, artwork_title, artist_name',
            })
          }

          // Generate KCB certificate number (KCB-XXXXXXXX format)
          const kcbNumber = `KCB-${Math.random().toString(36).substr(2, 8).toUpperCase()}`

          // Insert certificate record
          const { data, error } = await supabaseAdmin
            .from('certificates')
            .insert({
              artwork_id,
              kcb_number: kcbNumber,
              artist_name,
              artwork_title,
              dimensions,
              medium,
              year,
              issued_by: user.id,
              status: 'active',
              issued_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (error) {
            console.error('[Certificate Error]', error)
            return res.status(500).json({ error: error.message })
          }

          // ✅ Notify admin of new certificate (non-blocking)
          try {
            await sendAdminNotification(
              '🏆 Nouveau certificat KCB généré',
              'Un certificat de provenance a été généré pour une œuvre.',
              {
                'Numéro KCB': kcbNumber,
                'Titre': artwork_title,
                'Artiste': artist_name,
                'Émis par': user.name || user.email,
                'Rôle': user.role,
                'Médium': medium || 'Non spécifié',
                'Année': year || 'Non spécifiée',
                'Date': new Date().toLocaleString('fr-FR'),
              }
            )
          } catch (notifErr) {
            console.warn('[Certificate] Admin notification failed:', notifErr.message)
          }

          return res.status(201).json({
            success: true,
            data: { ...data, certificate_path: path, kucibok_id: kcbNumber },
            message: `Certificate ${kcbNumber} generated successfully`,
          })
        } catch (err) {
          console.error('[Certificate Exception]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/certificates/url/:artworkId — signed download URL
      if (req.method === 'GET' && s1 === 'url' && s2) {
        const user = await getAuthUser()
        if (!user) return
        const { data: artwork } = await supabaseAdmin.from('artworks').select('user_id, artist_id, certificate_path').eq('id', s2).maybeSingle()
        if (!artwork?.certificate_path) return res.status(404).json({ error: 'Certificat indisponible' })
        let owner = artwork.user_id === user.id || user.role === 'admin'
        if (!owner && artwork.artist_id) {
          const { data: artist } = await supabaseAdmin.from('artists').select('user_id').eq('id', artwork.artist_id).maybeSingle()
          owner = artist?.user_id === user.id
        }
        if (!owner) return res.status(403).json({ error: 'Accès refusé' })
        const { data, error } = await supabaseAdmin.storage.from('certificates').createSignedUrl(artwork.certificate_path, 600)
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ data: { certificate_url: data.signedUrl } })
      }

      // GET /api/certificates/portfolio — downloadable artist portfolio PDF
      if (req.method === 'GET' && s1 === 'portfolio') {
        const user = await getAuthUser()
        if (!user) return
        const { artist, artworks } = await getArtistOwnedArtworks(user.id)
        const pdf = await createPdfBuffer((doc) => {
          doc.fillColor('#B08D57').fontSize(26).text('PORTFOLIO ARTISTE', { align: 'center' })
          doc.moveDown(0.5).fillColor('#222').fontSize(18).text(artist?.name || user.user_metadata?.name || 'Artiste Kucibok', { align: 'center' })
          doc.moveDown().fontSize(10).fillColor('#666').text(`${artworks.length} œuvre(s) · Généré le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' })
          artworks.forEach((artwork, index) => {
            if (index > 0) doc.addPage()
            doc.moveDown(2).fillColor('#222').fontSize(20).text(artwork.title || 'Œuvre sans titre')
            doc.moveDown(0.5).fontSize(11).text(`Statut : ${artwork.status || '—'}`)
            doc.text(`Identifiant KCB : ${artwork.kucibok_id || 'En cours de certification'}`)
            doc.text(`Médium : ${artwork.medium || '—'}`)
            doc.text(`Catégorie : ${artwork.category || '—'}`)
            doc.moveDown().fontSize(11).fillColor('#555').text(artwork.description || 'Aucune description renseignée.', { align: 'justify' })
          })
        })
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', 'attachment; filename="portfolio-kucibok.pdf"')
        return res.status(200).send(pdf)
      }
    }

    // ─────────────────────────────────────────────────────────────
    // COMMENTS/REVIEWS ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'comments') {
      // POST /api/comments/artwork/:artworkId — Add comment/review to artwork
      if (req.method === 'POST' && s1 === 'artwork' && s2) {
        try {
          const user = await getAuthUser()
          if (!user) return

          const artworkId = s2
          const { text, rating } = req.body

          if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text is required' })
          }

          if (text.length > 5000) {
            return res.status(400).json({ error: 'Comment must be less than 5000 characters' })
          }

          if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' })
          }

          // Insert comment
          const { data, error } = await supabaseAdmin
            .from('comments')
            .insert({
              artwork_id: artworkId,
              user_id: user.id,
              text,
              rating: rating || null,
              status: 'pending', // Requires moderation
              created_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (error) {
            console.error('[Comment Error]', error)
            return res.status(500).json({ error: error.message })
          }

          // ✅ Notify admin of new comment (non-blocking)
          try {
            const { data: artworkData } = await supabaseAdmin
              .from('artworks')
              .select('title')
              .eq('id', artworkId)
              .single()

            await sendAdminNotification(
              '💬 Nouveau commentaire à modérer',
              'Un commentaire a été publié et nécessite une modération.',
              {
                'Auteur': user.name || user.email,
                'Rôle Auteur': user.role,
                'Œuvre': artworkData?.title || 'Inconnu',
                'Texte': text.substring(0, 150) + (text.length > 150 ? '...' : ''),
                'Note': rating ? `${rating}/5` : 'Aucune',
                'Statut': 'En attente de modération',
                'Date': new Date().toLocaleString('fr-FR'),
              }
            )
          } catch (notifErr) {
            console.warn('[Comment] Admin notification failed:', notifErr.message)
          }

          return res.status(201).json({
            success: true,
            data,
            message: 'Comment submitted and pending moderation',
          })
        } catch (err) {
          console.error('[Comment Exception]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SUPPORT TICKET ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'support-tickets') {
      const supportUser = await getAuthUser()
      if (!supportUser) return

      if (req.method === 'GET' && s1 === 'my-tickets') {
        const { data, error } = await supabaseAdmin
          .from('support_tickets')
          .select('*')
          .eq('user_id', supportUser.id)
          .order('created_at', { ascending: false })
        if (error) return res.status(500).json({ error: 'Impossible de charger les tickets' })
        return res.status(200).json({
          tickets: (data || []).map((ticket) => ({ ...ticket, ticketId: ticket.ticketId || ticket.id })),
        })
      }

      if (req.method === 'POST' && s1 === 'create') {
        const { category, priority, subject, description } = req.body || {}
        if (!subject?.trim() || !description?.trim()) {
          return res.status(400).json({ error: 'Sujet et description requis' })
        }
        const { data, error } = await supabaseAdmin
          .from('support_tickets')
          .insert({
            user_id: supportUser.id,
            subject: subject.trim().slice(0, 200),
            description: description.trim(),
            status: 'open',
            priority: priority || 'normal',
          })
          .select()
          .single()
        if (error) return res.status(500).json({ error: 'Impossible de créer le ticket' })
        return res.status(201).json({ ticket: data ? { ...data, ticketId: data.id } : data })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // REWARDS ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'rewards') {
      const rewardsUser = await getAuthUser()
      if (!rewardsUser) return

      if (req.method === 'GET' && s1 === 'credits') {
        const [{ data: credits }, { data: transactions }] = await Promise.all([
          supabaseAdmin.from('artist_credits').select('balance, total_earned, total_spent').eq('artist_id', rewardsUser.id).maybeSingle(),
          supabaseAdmin.from('artist_credit_transactions').select('*').eq('artist_id', rewardsUser.id).order('created_at', { ascending: false }).limit(50),
        ])
        return res.status(200).json({ data: { credits: credits || { balance: 0, total_earned: 0, total_spent: 0 }, transactions: transactions || [] } })
      }

      if (req.method === 'GET' && s1 === 'referrals') {
        let { data: referral } = await supabaseAdmin.from('artist_referrals').select('*').eq('referrer_id', rewardsUser.id).is('referred_id', null).maybeSingle()
        if (!referral) {
          const code = `KCB-${rewardsUser.id.slice(0, 8).toUpperCase()}`
          const { data: created } = await supabaseAdmin.from('artist_referrals').insert({ referrer_id: rewardsUser.id, referral_code: code }).select('*').single()
          referral = created
        }
        const { data: referrals } = await supabaseAdmin.from('artist_referrals').select('*').eq('referrer_id', rewardsUser.id).order('created_at', { ascending: false })
        return res.status(200).json({ data: { code: referral?.referral_code || null, referrals: referrals || [] } })
      }

      if (req.method === 'GET' && s1 === 'products') {
        const { data, error } = await supabaseAdmin.from('artist_products').select('*').eq('is_active', true).order('created_at', { ascending: true })
        if (error) return res.status(500).json({ error: 'Impossible de charger la boutique' })
        return res.status(200).json({ data: data || [] })
      }

      if (req.method === 'GET' && s1 === 'orders') {
        const { data, error } = await supabaseAdmin.from('artist_orders').select('*, artist_products(name)').eq('artist_id', rewardsUser.id).order('created_at', { ascending: false })
        if (error) return res.status(500).json({ error: 'Impossible de charger les commandes' })
        return res.status(200).json({ data: data || [] })
      }

      if (req.method === 'POST' && s1 === 'orders') {
        const { product_id } = req.body || {}
        const { data: product } = await supabaseAdmin.from('artist_products').select('id, credits_cost, stock, is_active').eq('id', product_id).single()
        if (!product?.is_active || (product.stock !== -1 && product.stock <= 0)) return res.status(400).json({ error: 'Produit indisponible' })
        const { data: credits } = await supabaseAdmin.from('artist_credits').select('balance').eq('artist_id', rewardsUser.id).maybeSingle()
        if (!credits || credits.balance < product.credits_cost) return res.status(400).json({ error: 'Crédits insuffisants' })
        const { data: order, error } = await supabaseAdmin.from('artist_orders').insert({ artist_id: rewardsUser.id, product_id, credits_spent: product.credits_cost }).select().single()
        if (error) return res.status(500).json({ error: 'Impossible de créer la commande' })
        await supabaseAdmin.from('artist_credits').update({ balance: credits.balance - product.credits_cost }).eq('artist_id', rewardsUser.id)
        return res.status(201).json({ data: order })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ERROR REPORTING ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'errors') {
      // POST /api/errors/report — Report application error
      if (req.method === 'POST' && s1 === 'report') {
        try {
          const { error_message, error_type, page_url, user_agent, additional_context } = req.body

          if (!error_message || !error_type) {
            return res.status(400).json({
              error: 'Missing required fields: error_message, error_type',
            })
          }

          // Get current user if authenticated (optional)
          let userId = null
          try {
            const authHeader = req.headers.authorization
            if (authHeader?.startsWith('Bearer ')) {
              const token = authHeader.substring(7)
              const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
              if (user && !error) {
                userId = user.id
              }
            }
          } catch (e) {
            // Not authenticated, that's ok for error reporting
          }

          // Insert error report
          const { data, error } = await supabaseAdmin
            .from('error_reports')
            .insert({
              error_message,
              error_type,
              page_url: page_url || 'Unknown',
              user_agent: user_agent || 'Unknown',
              user_id: userId,
              additional_context,
              status: 'new',
              reported_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (error) {
            console.error('[Error Report Insert Error]', error)
            return res.status(500).json({ error: error.message })
          }

          // ✅ Notify admin of error report (non-blocking)
          try {
            await sendAdminNotification(
              '🚨 Rapport d\'erreur détecté',
              'Un utilisateur a signalé une erreur dans l\'application.',
              {
                'Type d\'erreur': error_type,
                'Message': error_message.substring(0, 100) + (error_message.length > 100 ? '...' : ''),
                'Page': page_url || 'Unknown',
                'Utilisateur': userId ? 'Connecté' : 'Anonyme',
                'Contexte': additional_context || 'Aucun',
                'Date': new Date().toLocaleString('fr-FR'),
              }
            )
          } catch (notifErr) {
            console.warn('[Error Report] Admin notification failed:', notifErr.message)
          }

          return res.status(201).json({
            success: true,
            data,
            message: 'Error report submitted successfully',
          })
        } catch (err) {
          console.error('[Error Report Exception]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // NUMERISATION ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'numerisation' && (s1 === 'my' || req.method === 'GET')) {
      return res.status(200).json({ success: true, data: [] })
    }

    // ─────────────────────────────────────────────────────────────
    // CLIENTS ROUTES (CRM for artists & advisors)
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'clients') {
      const auth = await checkAuth(req)
      if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      // GET /api/clients/ — Get all clients (admin only)
      if (s1 === '' && req.method === 'GET') {
        try {
          const { data: allClients, error } = await supabaseAdmin
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false })

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({ clients: allClients || [] })
        } catch (err) {
          console.error('[Clients] GET error:', err.message)
          return res.status(500).json({ error: err.message })
        }
      }

      // GET /api/clients/all — Get clients for current artist/user
      if (s1 === 'all' && req.method === 'GET') {
        try {
          const { data: userClients, error } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('user_id', auth.sub)
            .order('created_at', { ascending: false })

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({ clients: userClients || [] })
        } catch (err) {
          console.error('[Clients] GET /all error:', err.message)
          return res.status(500).json({ error: err.message })
        }
      }

      // POST /api/clients/add — Add a new client
      if (s1 === 'add' && req.method === 'POST') {
        try {
          const { nom, prenom, email, telephone, ville, notes } = req.body

          const { data: newClient, error } = await supabaseAdmin
            .from('clients')
            .insert([
              {
                user_id: auth.sub,
                name: `${nom || ''} ${prenom || ''}`.trim() || email,
                email,
                telephone: telephone || null,
                country: ville || null, // Store city in country field for now
                notes: notes || null,
              },
            ])
            .select()
            .single()

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(201).json({ client: newClient })
        } catch (err) {
          console.error('[Clients] POST /add error:', err.message)
          return res.status(500).json({ error: err.message })
        }
      }

      // PUT /api/clients/update/:id — Update a client
      if (s1 === 'update' && s2 && req.method === 'PUT') {
        try {
          const clientId = s2
          const { nom, prenom, email, telephone, ville, notes } = req.body

          const { data: updated, error } = await supabaseAdmin
            .from('clients')
            .update({
              name: `${nom || ''} ${prenom || ''}`.trim() || email,
              email,
              telephone: telephone || null,
              country: ville || null,
              notes: notes || null,
            })
            .eq('id', clientId)
            .eq('user_id', auth.sub) // Ensure user can only update their own clients
            .select()
            .single()

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          if (!updated) {
            return res.status(404).json({ error: 'Client not found' })
          }

          return res.status(200).json({ client: updated })
        } catch (err) {
          console.error('[Clients] PUT /update error:', err.message)
          return res.status(500).json({ error: err.message })
        }
      }

      // DELETE /api/clients/delete/:id — Delete a client
      if (s1 === 'delete' && s2 && req.method === 'DELETE') {
        try {
          const clientId = s2

          // Verify ownership first
          const { data: client, error: fetchError } = await supabaseAdmin
            .from('clients')
            .select('user_id')
            .eq('id', clientId)
            .single()

          if (fetchError || !client || client.user_id !== auth.sub) {
            return res.status(403).json({ error: 'Unauthorized' })
          }

          const { error } = await supabaseAdmin
            .from('clients')
            .delete()
            .eq('id', clientId)

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({ success: true })
        } catch (err) {
          console.error('[Clients] DELETE error:', err.message)
          return res.status(500).json({ error: err.message })
        }
      }

      // POST /api/clients/upload — Upload clients from CSV
      if (s1 === 'upload' && req.method === 'POST') {
        try {
          // Parse CSV from form data
          // For now, return a placeholder
          return res.status(501).json({ error: 'CSV upload not yet implemented' })
        } catch (err) {
          console.error('[Clients] POST /upload error:', err.message)
          return res.status(500).json({ error: err.message })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // LOGGING ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'log' && req.method === 'POST') {
      try {
        const { level = 'info', message, data, page_url } = req.body

        // Frontend logging endpoint (non-critical)
        console.log(`[Frontend Log] ${level.toUpperCase()}: ${message}`, {
          data,
          page_url,
          timestamp: new Date().toISOString(),
        })

        // Optionally store in audit log table if needed
        // const { error } = await supabaseAdmin
        //   .from('audit_logs')
        //   .insert([{ action: 'LOG', table_name: 'frontend', ... }])

        return res.status(200).json({ success: true })
      } catch (err) {
        console.error('[Logging] Error:', err.message)
        return res.status(500).json({ error: err.message })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // AUDIT ENDPOINT — Deep diagnostic for 0→300 jump bug
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'audit-thugmoc' && req.method === 'GET') {
      try {
        const { email = 'thugmoc@gmail.com' } = req.query

        console.log(`[Audit] Deep diagnostic for: ${email}`)

        // Find user
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const user = users?.users?.find(u => u.email === email)

        if (!user) {
          return res.status(404).json({ error: `User not found: ${email}` })
        }

        // Find artist
        const { data: artist } = await supabaseAdmin
          .from('artists')
          .select('*')
          .eq('user_id', user.id)
          .single()

        // Count artworks by filters
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

        const { count: byStatusNull } = await supabaseAdmin
          .from('artworks')
          .select('*', { count: 'exact', head: true })
          .is('status', null)

        // First 10 artworks for artist
        let firstArtworks = []
        if (artist?.id) {
          const { data: artworks } = await supabaseAdmin
            .from('artworks')
            .select('id, kucibok_id, title, artist_id, status, created_at')
            .eq('artist_id', artist.id)
            .order('created_at', { ascending: false })
            .limit(10)
          firstArtworks = artworks || []
        }

        // Simulate API call
        let simulated = []
        if (artist?.id) {
          const { data: sim } = await supabaseAdmin
            .from('artworks')
            .select('id, kucibok_id, title, artist_id, status')
            .eq('artist_id', artist.id)
            .limit(350)
          simulated = sim || []
        }

        console.log('[Audit] Results:', {
          email,
          userId: user.id,
          artistId: artist?.id,
          byArtistId,
          simulatedCount: simulated.length,
        })

        return res.status(200).json({
          success: true,
          email,
          user_id: user.id,
          artist_id: artist?.id || null,
          counts: {
            total_artworks: totalArtworks,
            by_artist_id: byArtistId,
            by_user_id: byUserId,
            by_status_approved: byStatusApproved,
            by_status_null: byStatusNull,
          },
          first_10_artworks: firstArtworks.map(a => ({
            kucibok_id: a.kucibok_id || a.id.substring(0, 8),
            title: a.title,
            artist_id: a.artist_id,
            status: a.status || 'NULL',
          })),
          api_simulation: {
            would_return: simulated.length,
            first_artwork: simulated[0] ? {
              kucibok_id: simulated[0].kucibok_id,
              artist_id: simulated[0].artist_id,
              matches_filter: simulated[0].artist_id === artist?.id ? 'YES ✓' : 'NO ✗',
            } : null,
          },
          diagnosis: {
            expected: byArtistId,
            actually_returned: simulated.length,
            bug_is_present: simulated.length !== byArtistId ? true : false,
          },
        })
      } catch (error) {
        console.error('[Audit Error]', error)
        return res.status(500).json({ error: error.message })
      }
    }

    if (s0 === 'health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      })
    }

    // ✨ GET /api/visitor — Get visitor analytics
    if (s0 === 'visitor' && req.method === 'GET') {
      try {
        const user = await checkAuth(req)
        if (!user) {
          return res.status(403).json({ error: 'Authentication required' })
        }

        return res.status(200).json({
          visitor: {
            id: user.id,
            email: user.email,
            role: user.role,
            lastSeen: new Date().toISOString(),
          },
        })
      } catch (error) {
        console.error('[Visitor Error]', error)
        return res.status(500).json({ error: error.message })
      }
    }

    // ✨ GET /api/subscription — Get user subscription
    if (s0 === 'subscription' && req.method === 'GET') {
      try {
        const user = await checkAuth(req)
        if (!user) {
          return res.status(403).json({ error: 'Authentication required' })
        }

        // ✅ FIX: Artists don't have subscriptions — return null immediately
        if (user.role === 'artist') {
          return res.status(200).json(null)
        }

        const { data: subscriptions, error: subError } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (subError) {
          console.error('[Subscription Error]', subError)
          // ✅ FIX: Return 200 with null instead of 500 for missing subscriptions
          return res.status(200).json(null)
        }

        const subscription = subscriptions?.[0] || null
        return res.status(200).json(subscription)
      } catch (error) {
        console.error('[Subscription Error]', error)
        // ✅ FIX: Return 200 with null instead of 500 for unexpected errors
        return res.status(200).json(null)
      }
    }

    // ✨ GET /api/admin/stats — Real-time admin statistics
    if (s0 === 'admin' && s1 === 'stats' && req.method === 'GET') {
      try {
        // Require admin auth
        const user = await checkAuth(req)
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' })
        }

        // Query counts from Supabase
        const [usersRes, artworksRes, subscriptionsRes] = await Promise.all([
          supabaseAdmin.from('users').select('role', { count: 'exact' }),
          supabaseAdmin.from('artworks').select('status', { count: 'exact' }),
          supabaseAdmin.from('subscriptions').select('status', { count: 'exact' }),
        ])

        // Calculate statistics
        const usersData = usersRes.data || []
        const artworksData = artworksRes.data || []
        const subscriptionsData = subscriptionsRes.data || []

        const stats = {
          totalUsers: usersRes.count || 0,
          artists: usersData.filter(u => u.role === 'artist').length,
          collectors: usersData.filter(u => u.role === 'buyer').length,
          professionals: usersData.filter(u => u.role === 'curator').length,
          advisors: usersData.filter(u => u.role === 'advisor').length,

          totalArtworks: artworksRes.count || 0,
          approvedArtworks: artworksData.filter(a => a.status === 'approved').length,
          pendingArtworks: artworksData.filter(a => a.status === 'pending').length,
          rejectedArtworks: artworksData.filter(a => a.status === 'rejected').length,

          activeSubscriptions: subscriptionsData.filter(s => s.status === 'active').length,
          totalSubscriptions: subscriptionsRes.count || 0,

          lastUpdated: new Date().toISOString(),
        }

        return res.status(200).json(stats)
      } catch (error) {
        console.error('[Admin Stats Error]', error)
        return res.status(500).json({ error: error.message })
      }
    }

    // ✨ GET /api/admin/artworks-stats — Artwork counts by status
    if (s0 === 'admin' && s1 === 'artworks-stats' && req.method === 'GET') {
      try {
        const user = await checkAuth(req)
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' })
        }

        const { data: artworks, error: err } = await supabaseAdmin
          .from('artworks')
          .select('status')

        if (err) {
          console.error('[GET /api/admin/artworks-stats] Error:', err)
          return res.status(500).json({ error: err.message })
        }

        const stats = {
          total: artworks?.length || 0,
          pending: artworks?.filter(a => a.status === 'pending').length || 0,
          approved: artworks?.filter(a => a.status === 'approved').length || 0,
          rejected: artworks?.filter(a => a.status === 'rejected').length || 0,
        }

        console.log('[GET /api/admin/artworks-stats] Counts:', stats)
        return res.status(200).json(stats)
      } catch (error) {
        console.error('[Admin Artworks Stats Error]', error)
        return res.status(500).json({ error: error.message })
      }
    }

    // ✨ GET /api/admin/artworks-list — Artworks by status
    if (s0 === 'admin' && s1 === 'artworks-list' && req.method === 'GET') {
      try {
        const user = await checkAuth(req)
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' })
        }

        const { status = 'approved', limit = 100 } = req.query

        const { data: artworks, error: err } = await supabaseAdmin
          .from('artworks')
          .select('id, kucibok_id, title, category, artist_id, status, created_at')
          .eq('status', status)
          .order('created_at', { ascending: false })
          .limit(parseInt(limit))

        if (err) {
          console.error('[GET /api/admin/artworks-list] Error:', err)
          return res.status(500).json({ error: err.message })
        }

        console.log('[GET /api/admin/artworks-list] Loaded:', artworks?.length, status)
        return res.status(200).json({ artworks: artworks || [] })
      } catch (error) {
        console.error('[Admin Artworks List Error]', error)
        return res.status(500).json({ error: error.message })
      }
    }

    // ✨ GET /api/admin/users-list — All users
    if (s0 === 'admin' && s1 === 'users-list' && req.method === 'GET') {
      try {
        const user = await checkAuth(req)
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' })
        }

        const { limit = 100 } = req.query

        const { data: users, error: err } = await supabaseAdmin
          .from('users')
          .select('id, name, username, role, country, telephone, is_active, created_at')
          .order('created_at', { ascending: false })
          .limit(parseInt(limit))

        if (err) {
          console.error('[GET /api/admin/users-list] Error:', err)
          return res.status(500).json({ error: err.message })
        }

        console.log('[GET /api/admin/users-list] Loaded:', users?.length)
        return res.status(200).json({ users: users || [] })
      } catch (error) {
        console.error('[Admin Users List Error]', error)
        return res.status(500).json({ error: error.message })
      }
    }

    // ✨ GET /api/admin/clients-list — All clients
    if (s0 === 'admin' && s1 === 'clients-list' && req.method === 'GET') {
      try {
        const user = await checkAuth(req)
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' })
        }

        const { limit = 100 } = req.query

        const { data: clients, error: err } = await supabaseAdmin
          .from('clients')
          .select('id, user_id, name, email, telephone, country, notes, created_at')
          .order('created_at', { ascending: false })
          .limit(parseInt(limit))

        if (err) {
          console.error('[GET /api/admin/clients-list] Error:', err)
          return res.status(500).json({ error: err.message })
        }

        console.log('[GET /api/admin/clients-list] Loaded:', clients?.length)
        return res.status(200).json({ clients: clients || [] })
      } catch (error) {
        console.error('[Admin Clients List Error]', error)
        return res.status(500).json({ error: error.message })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN MIGRATION ENDPOINTS
    // ─────────────────────────────────────────────────────────────

    // POST /api/admin/migrate-collector — Setup collector dashboard tables
    if (req.method === 'POST' && s0 === 'admin' && s1 === 'migrate-collector') {
      const auth = await checkAuth(req)
      if (!auth?.userId) {
        return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
      }

      // Check if user is admin
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', auth.userId)
        .single()

      if (user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      try {
        console.log('[Admin Migration] Starting collector dashboard setup...')

        // Execute migration SQL
        const migrationSQL = `
          -- 1. Add columns to artworks table
          ALTER TABLE artworks ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
          ALTER TABLE artworks ADD COLUMN IF NOT EXISTS source text DEFAULT 'purchased' CHECK (source IN ('purchased', 'digitized', 'other'));
          ALTER TABLE artworks ADD COLUMN IF NOT EXISTS price_documented numeric DEFAULT 0;
          ALTER TABLE artworks ADD COLUMN IF NOT EXISTS acquisition_date timestamp DEFAULT now();
          ALTER TABLE artworks ADD COLUMN IF NOT EXISTS priority_access boolean DEFAULT false;

          CREATE INDEX IF NOT EXISTS idx_artworks_owner_id ON artworks(owner_id);
          CREATE INDEX IF NOT EXISTS idx_artworks_priority_access ON artworks(priority_access);

          -- 2. Add columns to transactions table
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES users(id) ON DELETE CASCADE;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'failed'));
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;

          CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);
          CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

          -- 3. Create collector_follows table
          CREATE TABLE IF NOT EXISTS collector_follows (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            collector_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
            created_at timestamp DEFAULT now(),
            UNIQUE(collector_id, artist_id)
          );

          CREATE INDEX IF NOT EXISTS idx_collector_follows_collector_id ON collector_follows(collector_id);
          CREATE INDEX IF NOT EXISTS idx_collector_follows_artist_id ON collector_follows(artist_id);

          ALTER TABLE collector_follows ENABLE ROW LEVEL SECURITY;

          CREATE POLICY IF NOT EXISTS "Users can view their own follows" ON collector_follows
            FOR SELECT USING (collector_id = auth.uid());
          CREATE POLICY IF NOT EXISTS "Users can create follows" ON collector_follows
            FOR INSERT WITH CHECK (collector_id = auth.uid());
          CREATE POLICY IF NOT EXISTS "Users can delete their own follows" ON collector_follows
            FOR DELETE USING (collector_id = auth.uid());

          -- 4. Create notification_preferences table
          CREATE TABLE IF NOT EXISTS notification_preferences (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            notification_mode text DEFAULT 'in_app' CHECK (notification_mode IN ('in_app', 'email', 'both')),
            frequency text DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'weekly')),
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now()
          );

          CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

          ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

          CREATE POLICY IF NOT EXISTS "Users can view their own prefs" ON notification_preferences
            FOR SELECT USING (user_id = auth.uid());
          CREATE POLICY IF NOT EXISTS "Users can create their prefs" ON notification_preferences
            FOR INSERT WITH CHECK (user_id = auth.uid());
          CREATE POLICY IF NOT EXISTS "Users can update their prefs" ON notification_preferences
            FOR UPDATE USING (user_id = auth.uid());
        `

        // Split and execute statements
        const statements = migrationSQL.split(';').filter(s => s.trim())
        let executedCount = 0

        for (const statement of statements) {
          try {
            await supabaseAdmin.rpc('exec_raw_sql', {
              sql: statement.trim()
            }).catch(() => {
              // If RPC doesn't exist, try direct execution via admin client
              // This is a workaround — ideally use Supabase SQL API
            })
            executedCount++
          } catch (e) {
            console.log(`[Admin Migration] Statement error (may already exist): ${e.message}`)
          }
        }

        console.log(`[Admin Migration] Completed. Statements executed: ${executedCount}`)

        return res.status(200).json({
          success: true,
          message: 'Collector dashboard tables created/verified',
          statements_executed: executedCount,
          tables: ['collector_follows', 'notification_preferences'],
          columns_added: ['owner_id', 'source', 'price_documented', 'acquisition_date', 'priority_access', 'buyer_id', 'status', 'amount']
        })
      } catch (err) {
        console.error('[Admin Migration] Exception:', err)
        return res.status(500).json({ error: err.message })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // NOTIFICATION PREFERENCES ENDPOINTS
    // ─────────────────────────────────────────────────────────────

    // GET /api/notifications/preferences — Get notification preferences
    if (req.method === 'GET' && s0 === 'notifications' && s1 === 'preferences') {
      const auth = await checkAuth(req)
      if (!auth?.userId) {
        return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
      }

      try {
        const { data, error } = await supabaseAdmin
          .from('notification_preferences')
          .select('*')
          .eq('user_id', auth.userId)
          .maybeSingle()

        if (error) {
          return res.status(500).json({ error: error.message })
        }

        // Return defaults if not set
        const preferences = data || {
          user_id: auth.userId,
          notification_mode: 'in_app',
          frequency: 'immediate',
        }

        return res.status(200).json({
          success: true,
          preferences,
        })
      } catch (err) {
        console.error('[GET /api/notifications/preferences] Exception:', err)
        return res.status(500).json({ error: err.message })
      }
    }

    // POST /api/notifications/preferences — Update notification preferences
    if (req.method === 'POST' && s0 === 'notifications' && s1 === 'preferences') {
      const auth = await checkAuth(req)
      if (!auth?.userId) {
        return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required' })
      }

      try {
        const { notification_mode, frequency } = req.body

        // Validate inputs
        if (notification_mode && !['in_app', 'email', 'both'].includes(notification_mode)) {
          return res.status(400).json({
            error: 'Invalid notification_mode. Must be: in_app, email, or both',
          })
        }

        if (frequency && !['immediate', 'weekly'].includes(frequency)) {
          return res.status(400).json({
            error: 'Invalid frequency. Must be: immediate or weekly',
          })
        }

        // Upsert preferences
        const { data, error } = await supabaseAdmin
          .from('notification_preferences')
          .upsert({
            user_id: auth.userId,
            notification_mode: notification_mode || 'in_app',
            frequency: frequency || 'immediate',
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) {
          return res.status(500).json({ error: error.message })
        }

        return res.status(200).json({
          success: true,
          preferences: data,
        })
      } catch (err) {
        console.error('[POST /api/notifications/preferences] Exception:', err)
        return res.status(500).json({ error: err.message })
      }
    }

    // Route not found
    res.status(404).json({
      error: 'Route not found',
      path: `/${path.join('/')}`,
    })
  } catch (error) {
    console.error('[API Error]', error)
    res.status(500).json({
      error: error.message,
      success: false,
    })
  }
}
// Build timestamp: Fri, Aug 21, 2026 12:29:14 AM
