#!/usr/bin/env node
/**
 * audit-artist-artworks-cjs.cjs — Audit Supabase DB (CommonJS version)
 *
 * Usage: node audit-artist-artworks-cjs.cjs <artist_id>
 * Example: node audit-artist-artworks-cjs.cjs fe40be9f-1f65-42ed-8743-ed5b3f89d448
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  console.error('   On PowerShell: $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const artistId = process.argv[2]
if (!artistId) {
  console.error('❌ Missing artist_id argument')
  console.error('Usage: node audit-artist-artworks-cjs.cjs <artist_id>')
  process.exit(1)
}

console.log(`\n📊 AUDIT: Artist Artworks for ${artistId}\n`)

async function audit() {
  try {
    // 1️⃣ Get artist info
    console.log('1️⃣  Fetching artist profile...')
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, user_id, name')
      .eq('id', artistId)
      .single()

    if (artistError || !artist) {
      console.error('❌ Artist not found:', artistError?.message)
      return
    }
    console.log(`   ✅ Artist: ${artist.name || 'Unnamed'} (user_id: ${artist.user_id})`)

    // 2️⃣ Count artworks by artist_id
    console.log('\n2️⃣  Counting artworks...')
    const { data: artworks, error: artworksError } = await supabase
      .from('artworks')
      .select('id, title, artist_id, user_id, status, created_at', { count: 'exact' })
      .eq('artist_id', artistId)

    if (artworksError) {
      console.error('❌ Query error:', artworksError.message)
      return
    }

    console.log(`   ✅ Found ${artworks?.length || 0} artworks with artist_id = ${artistId}`)

    // 3️⃣ Check if these artworks actually belong to this artist
    if (artworks && artworks.length > 0) {
      console.log('\n3️⃣  Verifying artworks ownership...')

      // Check if all artworks have matching artist_id
      const allMatch = artworks.every(a => a.artist_id === artistId)
      console.log(`   ${allMatch ? '✅' : '❌'} Filter test: ${allMatch ? 'PASS' : 'FAIL'}`)

      // Show first 5 artworks
      console.log('\n4️⃣  Sample artworks:')
      artworks.slice(0, 5).forEach((a, i) => {
        console.log(`   [${i + 1}] "${a.title}" (${a.status}) - created ${new Date(a.created_at).toLocaleDateString()}`)
      })

      if (artworks.length > 5) {
        console.log(`   ... and ${artworks.length - 5} more`)
      }

      // 5️⃣ DIAGNOSIS
      console.log('\n' + '='.repeat(60))
      console.log('📋 DIAGNOSIS:')
      console.log('='.repeat(60))

      if (artworks.length === 0) {
        console.log('✅ HEALTHY: Artist has 0 artworks (correct if never uploaded)')
      } else if (artworks.length <= 10) {
        console.log('✅ HEALTHY: Artist has a reasonable number of artworks')
      } else if (artworks.length === 300) {
        console.log('❌ CRITICAL: Artist has exactly 300 artworks!')
        console.log('   This suggests DATABASE CORRUPTION from migration.')
        console.log('   All artworks may have been incorrectly linked to this artist_id.')
        console.log('\n   ACTION NEEDED:')
        console.log('   - All 300 artworks should NOT belong to this artist')
        console.log('   - This is a data migration bug (MongoDB → Supabase)')
        console.log('   - Need to fix the artist_id linkage for these artworks')
      } else {
        console.log(`⚠️  SUSPICIOUS: Artist has ${artworks.length} artworks (unexpected number)`)
      }

      // 6️⃣ Check if artworks have user_id mismatch
      console.log('\n5️⃣  Checking user_id consistency...')
      const userIds = new Set(artworks.map(a => a.user_id))
      if (userIds.size === 1) {
        const userId = Array.from(userIds)[0]
        if (userId === artist.user_id) {
          console.log(`   ✅ All artworks have correct user_id: ${userId}`)
        } else {
          console.log(`   ❌ MISMATCH: Artworks have user_id ${userId}, but artist has ${artist.user_id}`)
          console.log('      → This indicates data corruption!')
        }
      } else {
        console.log(`   ❌ INCONSISTENT: Artworks have ${userIds.size} different user_ids:`)
        userIds.forEach(uid => console.log(`      - ${uid}`))
      }
    } else {
      console.log('✅ Artist has 0 artworks (healthy)')
    }

    console.log('\n' + '='.repeat(60) + '\n')

  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

audit()
