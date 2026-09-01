# Step-by-Step Implementation Guide

## ✅ Apply These Fixes to `api/[...path].js`

---

## STEP 1: Fix Subscription IDOR (10 minutes)

**Location:** Line 888-908  
**Search for:** `// GET /api/subscriptions/active/:user_id`

### What to change:

1. **Add authentication check** at the beginning of this block:
```javascript
// ✅ CRITICAL: Verify authentication
const authUser = await getAuthUser()
if (!authUser) return // getAuthUser() handles error response
```

2. **Add ownership verification** before the query:
```javascript
// ✅ CRITICAL: Verify ownership - can only view own subscription
if (s2 !== authUser.id) {
  return res.status(403).json({
    error: 'Forbidden',
    message: 'You can only view your own subscription'
  })
}
```

3. **Replace the query parameter** from `s2` to `authUser.id`:
```javascript
// BEFORE: .eq('user_id', s2)
// AFTER:
.eq('user_id', authUser.id)
```

4. **Sanitize error response** (optional but recommended):
```javascript
// BEFORE: return res.status(500).json({ error: error.message })
// AFTER:
console.error('[GET /api/subscriptions/active] Query error:', error.message)
return res.status(500).json({ error: 'Subscription query failed' })
```

**Test after fix:**
```bash
# Should fail (no auth)
curl -X GET "http://localhost:3000/api/subscriptions/active/any-id"
# Expected: 401 Unauthorized

# Should succeed (viewing own)
curl -X GET "http://localhost:3000/api/subscriptions/active/your-user-id" \
  -H "Authorization: Bearer your-token"
# Expected: 200 OK or null (if no subscription)
```

---

## STEP 2: Fix Shortlist GET IDOR (10 minutes)

**Location:** Line 1033-1062  
**Search for:** `// GET /api/shortlist — Get user's shortlist`

### What to change:

1. **Add authentication check** right after `if (req.method === 'GET' && !s1)`:
```javascript
// ✅ CRITICAL: Verify authentication
const authUser = await getAuthUser()
if (!authUser) return
```

2. **Remove the user_id validation** (delete these lines):
```javascript
// DELETE THESE LINES:
const { user_id } = req.query
if (!user_id) {
  return res.status(400).json({ error: 'user_id query param is required' })
}
```

3. **Replace all `user_id` references** with `authUser.id`:
```javascript
// BEFORE:
.eq('user_id', user_id)

// AFTER:
.eq('user_id', authUser.id)
```

4. **Sanitize error response** (optional):
```javascript
// BEFORE:
return res.status(500).json({ error: error.message, code: error.code })

// AFTER:
console.error('[GET /api/shortlist Error]', error.code, error.message)
return res.status(500).json({ error: 'Failed to retrieve shortlist' })
```

**Test after fix:**
```bash
# Should fail (no auth)
curl -X GET "http://localhost:3000/api/shortlist?user_id=any-id"
# Expected: 401 Unauthorized

# Should fail (query param ignored now)
curl -X GET "http://localhost:3000/api/shortlist?user_id=hacker-id" \
  -H "Authorization: Bearer victim-token"
# Expected: 200 OK with VICTIM's shortlist (not hacker's)

# Should succeed (getting own shortlist)
curl -X GET "http://localhost:3000/api/shortlist" \
  -H "Authorization: Bearer your-token"
# Expected: 200 OK with your shortlist
```

---

## STEP 3: Fix Shortlist PATCH IDOR (5 minutes)

**Location:** Line 1068-1097  
**Search for:** `// PATCH /api/shortlist/:artworkId — Update notes`

### What to change:

1. **Add authentication check** right after `if (req.method === 'PATCH' && s1)`:
```javascript
// ✅ CRITICAL: Verify authentication
const authUser = await getAuthUser()
if (!authUser) return
```

2. **Remove user_id from destructuring**, keep only notes:
```javascript
// BEFORE:
const { user_id, notes } = req.body

// AFTER:
const { notes } = req.body
const artworkId = s1
```

3. **Remove the user_id validation check**:
```javascript
// DELETE THIS:
if (!user_id || !s1) {
  return res.status(400).json({ error: 'user_id and artworkId are required' })
}

// KEEP THIS:
if (!artworkId) {
  return res.status(400).json({ error: 'Missing artworkId' })
}
```

4. **Add notes validation** (optional but good practice):
```javascript
if (notes && typeof notes === 'string' && notes.length > 1000) {
  return res.status(400).json({ error: 'Notes must be under 1000 characters' })
}
```

5. **Replace user_id in query** from body to auth:
```javascript
// BEFORE:
.eq('user_id', user_id)

// AFTER:
.eq('user_id', authUser.id)
```

6. **Sanitize error responses**:
```javascript
// BEFORE:
if (error) {
  return res.status(500).json({ error: error.message })
}

// AFTER:
if (error) {
  console.error('[PATCH /api/shortlist] Query error:', error.message)
  if (error.code === 'PGRST116') {
    return res.status(404).json({ error: 'Artwork not found in shortlist' })
  }
  return res.status(500).json({ error: 'Failed to update notes' })
}
```

**Test after fix:**
```bash
# Should fail (attempting to modify other user's shortlist)
curl -X PATCH "http://localhost:3000/api/shortlist/artwork-123" \
  -H "Authorization: Bearer my-token" \
  -d '{"user_id": "victim-id", "notes": "sabotage"}'
# Expected: 404 Not Found (artwork not in MY shortlist)

# Should succeed (modify own shortlist)
curl -X PATCH "http://localhost:3000/api/shortlist/artwork-123" \
  -H "Authorization: Bearer my-token" \
  -d '{"notes": "very interested"}'
# Expected: 200 OK with updated data
```

---

## STEP 4: Sanitize Error Messages (15 minutes)

**Location:** Throughout the file  
**Search for:** `error.message` in responses

### Find and replace pattern:

**Search:**
```
return res.status(500).json({ error: error.message })
```

**Replace with:**
```javascript
console.error('[Endpoint Name]', error.message)
if (error.code === '23505') {
  return res.status(409).json({ error: 'This record already exists' })
}
if (error.code === '23503') {
  return res.status(400).json({ error: 'Invalid reference' })
}
return res.status(500).json({ error: 'Database operation failed' })
```

### Common error codes to handle:

| Code | Meaning | User Message |
|------|---------|--------------|
| 23505 | Duplicate key | "This record already exists" |
| 23503 | Foreign key violation | "Invalid reference (related record not found)" |
| 23502 | NOT NULL violation | "Missing required fields" |
| 42P01 | Table doesn't exist | "Database table not found" |
| PGRST116 | No rows returned | "Record not found" |

**Locations to fix** (grep for error.message):
- Line 901: subscriptions error
- Line 1054: shortlist query error
- Line 1086: shortlist update error
- And 20+ other places (search entire file)

---

## STEP 5: Remove Debug Fields (5 minutes)

**Location:** Throughout the file  
**Search for:** `_debug` or `filterDiagnosis`

### Find and remove:

**Search for:**
```
_debug:
```

**Delete these entire lines:**
```javascript
// DELETE THESE:
_debug: filterDiagnosis,
_debug: { artist_id, filter_match },
```

**Instead, log server-side:**
```javascript
// Keep debugging info in logs only
console.log('[Debug] Filter diagnosis:', filterDiagnosis)

// Return clean response without _debug
return res.status(200).json({
  success: true,
  artworks: artworksWithArtistNames,
  count: artworksWithArtistNames.length,
  // ✅ No _debug field exposed to client
})
```

**All locations to check:**
```bash
# Search in terminal:
grep -n "_debug\|filterDiagnosis" api/[...path].js
```

---

## STEP 6: Add Auth to Public Endpoints (5 minutes)

**Location:** `/api/contact` and `/api/sourcing/inquiries`  

### Pattern to apply:

**BEFORE (vulnerable):**
```javascript
if (s0 === 'contact' && req.method === 'POST') {
  const { name, email, message } = req.body
  // No auth check - SPAM VULNERABILITY
}
```

**AFTER (fixed):**
```javascript
if (s0 === 'contact' && req.method === 'POST') {
  // ✅ CRITICAL: Verify authentication
  const authUser = await getAuthUser()
  if (!authUser) return

  const { message } = req.body

  // Use authenticated user's email
  const senderEmail = authUser.email

  // Validate input
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' })
  }

  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message too long' })
  }

  // Continue with form submission...
}
```

---

## STEP 7: Quick Validation

Before you commit, run this validation:

```bash
# 1. Check for remaining unpatched IDOR patterns
grep -n "const { user_id } = req.query" api/[...path].js
# Should return: 0 results (all fixed)

grep -n "\.eq('user_id', user_id)" api/[...path].js
# Should return: 0 results (all use authUser.id)

# 2. Check for error.message leaks
grep -n "error\.message" api/[...path].js | grep "res.status"
# Review each result - should be rare

# 3. Check for debug fields
grep -n "_debug:" api/[...path].js
# Should return: 0 results (all removed)

# 4. Check that getAuthUser() is used in sensitive endpoints
grep -B2 -A2 "shortlist\|subscription" api/[...path].js | grep "getAuthUser"
# Should show getAuthUser() check for each endpoint
```

---

## STEP 8: Test Everything

```bash
# 1. Build and run tests
yarn build
yarn test

# 2. Start dev server
yarn dev

# 3. Run manual tests (see curl examples in each step)

# 4. Test all 6 fixes work correctly
```

---

## STEP 9: Create and Merge PR

```bash
# Create feature branch
git checkout -b security/fix-idor-vulnerabilities

# Commit changes
git add api/[...path].js
git commit -m "fix: Close IDOR vulnerabilities in subscription & shortlist endpoints

CRITICAL SECURITY FIXES:
- Fix subscription data leak (IDOR) - Line 888
- Fix shortlist GET IDOR - Line 1033
- Fix shortlist PATCH IDOR - Line 1068
- Sanitize error messages throughout
- Remove debug fields from responses
- Add auth to contact/sourcing endpoints

Fixes:
- Added authentication checks to protected endpoints
- Added ownership verification
- Removed user_id from request parameters
- Sanitized error messages to prevent information disclosure
- Removed debug fields that enable user enumeration

All changes are defensive (adding auth) and won't break existing workflows."

# Push to GitHub
git push origin security/fix-idor-vulnerabilities

# Create PR on GitHub
# - Reference this guide in PR body
# - Add testing checklist
# - Link SECURITY_FIXES_PR.md in description
```

---

## STEP 10: Post-Deployment Verification

After deploying to production:

```bash
# 1. Monitor logs for errors
# - Check Sentry for new errors
# - Review any 401/403 responses

# 2. Smoke test critical flows
# - Login with email/password
# - Browse artworks as authenticated user
# - View subscription status
# - Update shortlist

# 3. Verify IDOR is blocked
# - Try to access other user's shortlist
# - Should get 401 or 403 (depending on auth)

# 4. Check error messages
# - Trigger an error in API
# - Verify it doesn't leak database info
```

---

## Common Issues & Solutions

### Issue: Tests fail after applying fixes

**Solution:** 
- Make sure `getAuthUser()` calls return early on error
- Check that test auth tokens are valid
- Verify Supabase is accessible in test environment

### Issue: Existing integrations break

**Solution:**
- This is unlikely (only adding auth checks)
- If client was relying on unauthenticated endpoints, update client code to include auth header
- Verify auth header format: `Authorization: Bearer <token>`

### Issue: Error messages are still leaking

**Solution:**
- Search more thoroughly: `error.message`, `error.code`, `error.details`
- Replace ALL with generic messages
- Log full error server-side instead

### Issue: Some endpoints still show debug info

**Solution:**
- Search for `_debug`, `filterDiagnosis`, `audit`, `diagnosis`
- Check JSON.stringify of any response object
- Remove all exposing fields

---

## Checklist - Print & Check Off

```
IMPLEMENTATION CHECKLIST
========================

[ ] Step 1: Fix Subscription IDOR (Line 888)
    [ ] Add getAuthUser() check
    [ ] Add ownership verification
    [ ] Replace s2 with authUser.id
    [ ] Sanitize error messages
    [ ] Test with curl

[ ] Step 2: Fix Shortlist GET IDOR (Line 1033)
    [ ] Add getAuthUser() check
    [ ] Remove user_id from req.query
    [ ] Replace user_id with authUser.id
    [ ] Sanitize error messages
    [ ] Test with curl

[ ] Step 3: Fix Shortlist PATCH IDOR (Line 1068)
    [ ] Add getAuthUser() check
    [ ] Remove user_id from req.body
    [ ] Replace user_id with authUser.id
    [ ] Add notes validation
    [ ] Sanitize error messages
    [ ] Test with curl

[ ] Step 4: Sanitize Error Messages
    [ ] Search for "error.message" in responses
    [ ] Replace with generic messages
    [ ] Log full errors server-side
    [ ] Handle all error codes: 23505, 23503, 42P01

[ ] Step 5: Remove Debug Fields
    [ ] Search for "_debug"
    [ ] Search for "filterDiagnosis"
    [ ] Remove from all responses
    [ ] Keep in console.log

[ ] Step 6: Add Auth to Public Endpoints
    [ ] /api/contact needs auth
    [ ] /api/sourcing/inquiries needs auth
    [ ] Input validation added

[ ] Step 7: Validation
    [ ] grep checks pass
    [ ] No remaining IDOR patterns
    [ ] No error message leaks
    [ ] No debug fields

[ ] Step 8: Testing
    [ ] yarn build passes
    [ ] yarn test passes
    [ ] Manual curl tests work
    [ ] All 6 fixes verified

[ ] Step 9: PR & Merge
    [ ] Branch created
    [ ] PR created with description
    [ ] Code review passed
    [ ] Merged to main

[ ] Step 10: Production
    [ ] Deployed to production
    [ ] Monitoring logs
    [ ] Smoke tests passed
    [ ] IDOR attempts blocked
```

---

**Estimated total time: 50 minutes**

Need help with any step? Refer to SECURITY_FIXES_CODE.js for code examples and SECURITY_FIXES_PR.md for detailed explanations.
