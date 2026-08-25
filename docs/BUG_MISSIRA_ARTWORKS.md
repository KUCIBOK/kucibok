# Bug Fix: Missira Keita Artworks Not Visible on Artist Dashboard

## Problem Description

When Missira Keita (and potentially other artists) log into their artist dashboard, they see **no artworks**, even though their artworks are visible:
- ✅ In the sourcing catalog (curator/advisor dashboards)
- ✅ In the admin dashboard
- ❌ In their own artist dashboard

## Root Cause

The bug was in the **API endpoint** `GET /api/artworks` (api/[...path].js:150-193).

### The Issue

The API had a **default status filter** that was applied to ALL requests:

```javascript
const {
  status = 'approved',  // ← BUG: Default to 'approved'
  artist_id,
  user_id,
  ...
} = req.query

if (status) query = query.eq('status', status)  // ← Always applied
```

**What happened:**
1. When an artist fetches their own artworks via `GET /api/artworks?artist_id=:id`
2. The API added a default filter `status = 'approved'`
3. If the artist's artwork had status `pending`, `rejected`, or other — **it was hidden**
4. Result: Artist dashboard shows 0 artworks

### Why This Affected Other Features

- **Sourcing Catalog** (curator/advisor): Shows all artworks with explicit status filters
- **Admin Dashboard**: Fetches with explicit status filters
- **Artist Dashboard**: Only passes `artist_id` without status, relies on default

## Solution

Modified the API to **NOT apply the default `status='approved'` filter** when fetching artworks for a specific artist or user:

```javascript
// ✅ FIX: Only apply default status='approved' filter if no artist_id or user_id is specified
// When fetching artworks for a specific artist/user, return ALL artworks (not just approved)
const hasOwnerFilter = artist_id || user_id
const statusToApply = status || (hasOwnerFilter ? null : 'approved')

if (statusToApply) query = query.eq('status', statusToApply)
```

**Behavior after fix:**
- `GET /api/artworks` → Filters to `status='approved'` (public marketplace)
- `GET /api/artworks?artist_id=X` → Returns ALL artworks (owner can see all statuses)
- `GET /api/artworks?user_id=X` → Returns ALL artworks (owner can see all)
- `GET /api/artworks?status=pending` → Returns pending artworks (explicit filter respected)

## Files Changed

1. **api/[...path].js** (lines 150-193)
   - Changed default status handling
   - Added logic to skip default filter when artist_id or user_id is present

## Testing

Run diagnostic scripts to verify:

```bash
# 1. Check Missira's profile and artworks
node scripts/diagnose-missira-full.js

# 2. Check artwork visibility by status
node scripts/diagnose-missira-artworks.js
```

### Expected After Fix

- Missira's artist profile loads correctly
- All her artworks appear in dashboard (pending, approved, rejected, etc.)
- Sourcing catalog still shows only approved artworks
- Admin dashboard still shows all statuses with filtering

## Database Queries to Verify

```sql
-- Check Missira's user and artist IDs
SELECT id, email, role FROM users WHERE email LIKE '%missira%';

-- Check Missira's artworks (all statuses)
SELECT id, title, status, for_sale FROM artworks
WHERE artist_id = '[MISSIRA_ARTIST_ID]'
ORDER BY created_at DESC;

-- Verify artworks by user_id fallback
SELECT id, title, status, artist_id FROM artworks
WHERE user_id = '[MISSIRA_USER_ID]'
ORDER BY created_at DESC;
```

## Related Issues

- **issue**: Artist dashboard showing 0 artworks
- **affected**: Any artist role using `getMyArtworks()`
- **visibility**: Only in artist dashboard, not in public/curator views

## Notes

- The frontend (ArtworkContext.jsx) correctly calls `getMyArtworks(artistProfile.id)`
- The issue was purely backend API filtering logic
- This fix maintains backward compatibility for all other use cases
- Public marketplace still respects status='approved' by default
