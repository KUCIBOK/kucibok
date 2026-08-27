/**
 * api/[...path].js — Catch-all Vercel Function for all API routes
 * Disables caching to fix 304 responses
 */

import { createClient } from '@supabase/supabase-js'
import { respondJSON, respondError, checkAuth } from './_lib/response.js'
import { requireAuth } from './_lib/auth.js'
import { checkRateLimit, addRateLimitHeaders } from './_lib/rateLimit.js'
import { handleProfessionalAnalytics } from './_modules/professional-analytics-fixed.js'

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

    // ✅ Helper function: Validate email
    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
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
          limit = 300,
        } = req.query

        // ✅ CRITICAL FIX: Select WITHOUT relation first, apply filters, THEN add relation
        // Reason: select('*, artists(id, name)') with filters causes Supabase to return 300 rows
        // The LEFT JOIN doesn't properly respect the filters

        // ✅ FIX: Only apply default status='approved' filter if no artist_id or user_id is specified
        // When fetching artworks for a specific artist/user, return ALL artworks (not just approved)
        const hasOwnerFilter = artist_id || user_id
        const statusToApply = status || (hasOwnerFilter ? null : 'approved')

        console.log('[Artworks Filter] INPUT:', {artist_id, user_id, status: statusToApply, for_sale, category, limit})

        // Start with simple select (no relations yet)
        let query = supabaseAdmin.from('artworks').select('*')

        // Apply ALL filters FIRST
        if (statusToApply) query = query.eq('status', statusToApply)
        if (for_sale === 'true') query = query.eq('for_sale', true)
        if (artist_id) query = query.eq('artist_id', artist_id)
        if (user_id) query = query.eq('user_id', user_id)
        if (category) query = query.eq('category', category)

        // Order and limit
        query = query.order('created_at', { ascending: false }).limit(parseInt(limit))

        const { data: filteredArtworks, error } = await query

        console.log('[Artworks Filter] OUTPUT:', filteredArtworks?.length, 'artworks returned')

        if (error) {
          return res.status(500).json({
            error: error.message,
            success: false,
            artworks: [],
          })
        }

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

        return res.status(200).json({
          success: true,
          artworks: artworksWithArtistNames,
          count: artworksWithArtistNames.length,
        })
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

        const { data, error } = await supabaseAdmin.from('artworks').insert([body]).select()

        if (error) {
          return res.status(500).json({ error: error.message })
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

        // ✅ CRITICAL: Validate input
        const validationErrors = validateArtwork(req.body)
        if (validationErrors.length > 0) {
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

        const { data, error } = await supabaseAdmin
          .from('artworks')
          .update(body)
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
      if (req.method === 'GET' && s1) {
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
                email: authUser.email,
                role: 'buyer', // Default role
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
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
              needs_role_selection: !existingUser.role || existingUser.role === 'buyer',
            },
          })
        } catch (err) {
          console.error('[Google Callback Error]', err.message)
          return res.status(500).json({ error: err.message || 'OAuth callback failed' })
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
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('user_id', s2)
          .in('status', ['active', 'trial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows found
          return res.status(500).json({ error: error.message })
        }

        return res.status(200).json({
          success: true,
          data: data || null,
        })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SHORTLIST ROUTES
    // ─────────────────────────────────────────────────────────────

    if (s0 === 'shortlist') {
      // POST /api/shortlist/:artworkId — Add to shortlist
      if (req.method === 'POST' && s1) {
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
        const { user_id } = req.query

        if (!user_id) {
          return res.status(400).json({ error: 'user_id query param is required' })
        }

        try {
          const { data, error } = await supabaseAdmin
            .from('shortlisted_artworks')
            .select('*, artworks(*)')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })

          if (error) {
            console.error('[GET /api/shortlist Error]', error.code, error.message)
            // If table doesn't exist, provide helpful message
            if (error.code === 'PGRST116') {
              return res.status(200).json({ success: true, data: [], count: 0 })
            }
            return res.status(500).json({ error: error.message, code: error.code })
          }

          return res.status(200).json({
            success: true,
            data: data || [],
            count: (data || []).length,
          })
        } catch (err) {
          console.error('[Shortlist Get Exception]', err.message)
          return res.status(500).json({ error: err.message })
        }
      }

      // PATCH /api/shortlist/:artworkId — Update notes
      if (req.method === 'PATCH' && s1) {
        const { user_id, notes } = req.body

        if (!user_id || !s1) {
          return res.status(400).json({ error: 'user_id and artworkId are required' })
        }

        try {
          const { data, error } = await supabaseAdmin
            .from('shortlisted_artworks')
            .update({ notes: notes || '' })
            .eq('user_id', user_id)
            .eq('artwork_id', s1)
            .select()
            .single()

          if (error) {
            return res.status(500).json({ error: error.message })
          }

          return res.status(200).json({
            success: true,
            data,
            message: 'Notes updated',
          })
        } catch (err) {
          console.error('[Shortlist Update Error]', err)
          return res.status(500).json({ error: err.message })
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
          const { data: artistData, error: artistError } = await supabaseAdmin
            .from('artists')
            .select('*')
            .eq('user_id', s1)
            .single()

          if (artistError || !artistData) {
            // Fallback to users table if artist profile not found
            const { data: fallbackData } = await supabaseAdmin
              .from('users')
              .select('*')
              .eq('id', s1)
              .single()
            return res.status(200).json({ success: true, data: fallbackData })
          }

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
        if (!user) return

        // ✅ CRITICAL: Verify user can only modify their own artist profile
        // The s1 is the user_id, check if the artist profile belongs to this user
        const { data: artistCheck, error: checkError } = await supabaseAdmin
          .from('artists')
          .select('id, user_id')
          .eq('user_id', s1)
          .single()

        if (checkError || !artistCheck) {
          return res.status(404).json({ error: 'Artist profile not found' })
        }

        // ✅ Verify user owns this artist profile
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

        // Update artist profile
        const { data, error } = await supabaseAdmin
          .from('artists')
          .update(body)
          .eq('id', artistCheck.id)
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
    // NUMERISATION ROUTE
    // ─────────────────────────────────────────────────────────────
    if (s0 === 'numerisation' && (s1 === 'my' || req.method === 'GET')) {
      return res.status(200).json({ success: true, data: [] })
    }

    if (s0 === 'health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      })
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
