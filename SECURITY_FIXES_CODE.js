/**
 * SECURITY FIXES CODE - KUCIBOK API
 *
 * Apply these fixes to api/[...path].js
 *
 * Issues Fixed:
 * 1. Subscription IDOR (Line ~888)
 * 2. Shortlist GET IDOR (Line ~1033)
 * 3. Shortlist PATCH IDOR (Line ~1068)
 * 4. Error message sanitization
 * 5. Debug field removal
 * 6. Auth on sourcing/contact
 */

// ═══════════════════════════════════════════════════════════════════════════
// FIX #1: SUBSCRIPTION IDOR VULNERABILITY (Replace lines 888-908)
// ═══════════════════════════════════════════════════════════════════════════

// BEFORE (VULNERABLE):
/*
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
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({
    success: true,
    data: data || null,
  })
}
*/

// AFTER (FIXED):
// GET /api/subscriptions/active/:user_id — Get active subscription
if (req.method === 'GET' && s1 === 'active' && s2) {
  // ✅ CRITICAL: Verify authentication
  const authUser = await getAuthUser()
  if (!authUser) return // getAuthUser() handles error response

  // ✅ CRITICAL: Verify ownership - can only view own subscription
  if (s2 !== authUser.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only view your own subscription'
    })
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', authUser.id)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[GET /api/subscriptions/active] Query error:', error.message)
    return res.status(500).json({ error: 'Subscription query failed' })
  }

  return res.status(200).json({
    success: true,
    data: data || null,
  })
}


// ═══════════════════════════════════════════════════════════════════════════
// FIX #2: SHORTLIST GET IDOR VULNERABILITY (Replace lines 1033-1062)
// ═══════════════════════════════════════════════════════════════════════════

// BEFORE (VULNERABLE):
/*
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
    // ...
  }
}
*/

// AFTER (FIXED):
// GET /api/shortlist — Get user's shortlist
if (req.method === 'GET' && !s1) {
  // ✅ CRITICAL: Verify authentication
  const authUser = await getAuthUser()
  if (!authUser) return // getAuthUser() handles error response

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
    console.error('[GET /api/shortlist Exception]', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// FIX #3: SHORTLIST PATCH IDOR VULNERABILITY (Replace lines 1068-1097)
// ═══════════════════════════════════════════════════════════════════════════

// BEFORE (VULNERABLE):
/*
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
*/

// AFTER (FIXED):
// PATCH /api/shortlist/:artworkId — Update notes
if (req.method === 'PATCH' && s1) {
  // ✅ CRITICAL: Verify authentication
  const authUser = await getAuthUser()
  if (!authUser) return // getAuthUser() handles error response

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


// ═══════════════════════════════════════════════════════════════════════════
// FIX #4: ERROR MESSAGE SANITIZATION HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitizes database errors to prevent information disclosure
 * PostgreSQL error codes that should be caught:
 * - 23505: Unique constraint violation (duplicate key)
 * - 23503: Foreign key constraint violation
 * - 23502: Not null constraint violation
 * - 42P01: Table doesn't exist
 */
const sanitizeDbError = (error) => {
  if (!error) return 'Database operation failed'

  const code = error.code
  const message = error.message

  // Log full error server-side for debugging
  console.error(`[DB Error ${code}]`, message)

  // Return generic messages to client
  switch (code) {
    case '23505':
      return 'This record already exists'
    case '23503':
      return 'Invalid reference (related record not found)'
    case '23502':
      return 'Missing required fields'
    case '42P01':
      return 'Database table not found'
    case 'PGRST116':
      return 'Record not found' // No rows returned
    default:
      return 'Database operation failed'
  }
}

// USAGE PATTERN - Replace throughout api/[...path].js:
// BEFORE:
//   return res.status(500).json({ error: error.message })
// AFTER:
//   return res.status(500).json({ error: sanitizeDbError(error) })


// ═══════════════════════════════════════════════════════════════════════════
// FIX #5: REMOVE DEBUG FIELDS FROM RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

// Search for "_debug" or "filterDiagnosis" in responses and REMOVE:

// BEFORE (VULNERABLE):
/*
const filterDiagnosis = {
  artist_id: artist_id || null,
  user_id: user_id || null,
  returned_count: artworksWithArtistNames.length,
  filter_match: artist_id ? (filteredArtworks?.[0]?.artist_id === artist_id ? 'YES ✓' : 'NO ✗ MISMATCH!') : 'N/A',
}

return res.status(200).json({
  success: true,
  artworks: artworksWithArtistNames,
  count: artworksWithArtistNames.length,
  _debug: filterDiagnosis,  // ❌ REMOVE THIS LINE
})
*/

// AFTER (FIXED):
/*
return res.status(200).json({
  success: true,
  artworks: artworksWithArtistNames,
  count: artworksWithArtistNames.length,
  // ✅ Debug info removed - log server-side only
})
*/

// Keep debug info in console.log for development:
// console.log('[Debug Info]', filterDiagnosis)


// ═══════════════════════════════════════════════════════════════════════════
// FIX #6: ADD AUTHENTICATION TO PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Add authentication to /api/contact and /api/sourcing/inquiries

// BEFORE (VULNERABLE - allows unauthenticated spam):
/*
if (s0 === 'contact' && req.method === 'POST') {
  const { name, email, message } = req.body
  // Process contact form without auth check
}
*/

// AFTER (FIXED - requires authentication):
if (s0 === 'contact' && req.method === 'POST') {
  // ✅ CRITICAL: Verify authentication (prevents spam)
  const authUser = await getAuthUser()
  if (!authUser) return // getAuthUser() handles error response

  const { name, email, message } = req.body

  // ✅ Optional: Validate input
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' })
  }

  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message too long (max 5000 characters)' })
  }

  // Use authenticated user's email, don't trust client
  const senderEmail = authUser.email
  const senderName = authUser.name || email

  // Continue with form submission...
}


// ═══════════════════════════════════════════════════════════════════════════
// FIX #7: GLOBAL ERROR HANDLER (Optional but recommended)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Centralized error response handler
 * Use this in all try-catch blocks to ensure consistent error messages
 */
const handleEndpointError = (res, error, context = 'Operation') => {
  console.error(`[${context}]`, error.message)

  // Handle specific database errors
  if (error.code === '23505') {
    return res.status(409).json({ error: 'This record already exists' })
  }
  if (error.code === '23503') {
    return res.status(400).json({ error: 'Invalid reference (related record not found)' })
  }
  if (error.code === 'PGRST116') {
    return res.status(404).json({ error: 'Record not found' })
  }

  // Handle Supabase errors
  if (error.status) {
    return res.status(error.status).json({ error: 'Operation failed' })
  }

  // Default: return 500 without leaking details
  return res.status(500).json({ error: 'Internal server error' })
}

// USAGE:
/*
try {
  const { data, error } = await supabaseAdmin.from('table').select('*')
  if (error) return handleEndpointError(res, error, 'GET /api/endpoint')
  return res.status(200).json({ data })
} catch (err) {
  return handleEndpointError(res, err, 'GET /api/endpoint')
}
*/


// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPER - Add input validation to POST/PATCH endpoints
// ═══════════════════════════════════════════════════════════════════════════

const validateInput = (data, rules) => {
  const errors = []

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field]

    if (rule.required && (!value || value.toString().trim() === '')) {
      errors.push(`${field} is required`)
    }
    if (rule.maxLength && value && value.length > rule.maxLength) {
      errors.push(`${field} must be under ${rule.maxLength} characters`)
    }
    if (rule.minLength && value && value.length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters`)
    }
    if (rule.type === 'email' && value && !value.includes('@')) {
      errors.push(`${field} must be a valid email`)
    }
  }

  return errors
}

// USAGE:
/*
const errors = validateInput(req.body, {
  notes: { required: true, maxLength: 1000 },
  email: { required: true, type: 'email' },
})
if (errors.length > 0) {
  return res.status(400).json({ errors })
}
*/


// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════

/*
FIXES TO APPLY TO api/[...path].js:

[ ] 1. Replace GET /api/subscriptions/active/:user_id (line ~888)
    - Add getAuthUser() check
    - Add ownership verification (s2 === authUser.id)
    - Sanitize error messages

[ ] 2. Replace GET /api/shortlist (line ~1033)
    - Add getAuthUser() check
    - REMOVE user_id from req.query
    - Use authUser.id always
    - Sanitize error messages

[ ] 3. Replace PATCH /api/shortlist/:artworkId (line ~1068)
    - Add getAuthUser() check
    - REMOVE user_id from req.body
    - Use authUser.id always
    - Add input validation (notes length)
    - Sanitize error messages

[ ] 4. Add sanitizeDbError() helper function
    [ ] Replace all `error.message` responses with sanitizeDbError(error)
    [ ] Search and replace in at least 20+ locations

[ ] 5. Remove debug fields from responses
    [ ] Search for "_debug" and remove from JSON responses
    [ ] Search for "filterDiagnosis" and remove
    [ ] Keep debug info in console.log instead

[ ] 6. Add authentication to public endpoints
    [ ] /api/contact - add getAuthUser() check
    [ ] /api/sourcing/inquiries - add getAuthUser() check
    [ ] Any other POST endpoints accepting public input

[ ] 7. Test all fixes locally
    [ ] Run: yarn test
    [ ] Test each endpoint with curl commands (see SECURITY_FIXES_PR.md)
    [ ] Verify no breaking changes

[ ] 8. Deploy to staging and test
    [ ] Verify endpoints work with authentication
    [ ] Verify IDOR attempts are blocked
    [ ] Check error messages are generic

[ ] 9. Create PR and request review
    [ ] Reference all 6 fixes in PR description
    [ ] Include testing checklist
    [ ] Link this file in PR

[ ] 10. Deploy to production
    [ ] Merge PR
    [ ] Monitor logs for errors
    [ ] Check Sentry for any issues
*/
