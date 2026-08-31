#!/usr/bin/env node
/**
 * deep-audit-thugmoc.js — Deep diagnostic for thugmoc@gmail.com 0→300 jump bug
 *
 * This script performs a COMPLETE audit:
 * 1. Find user by email
 * 2. Get artist profile
 * 3. Count artworks by artist_id vs user_id vs other criteria
 * 4. Test API endpoint with exact parameters
 * 5. Trace filtering logic
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = 'thugmoc@gmail.com'

async function audit() {
  console.log(`\n🔍 DEEP AUDIT: thugmoc@gmail.com — 0→300 Jump Bug\n`)
  console.log('=' .repeat(80))

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1️⃣ FIND USER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n1️⃣ FINDING USER BY EMAIL...\n')
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    const user = users?.users?.find(u => u.email === email)

    if (!user) {
      console.error(`❌ User not found: ${email}`)
      return
    }

    console.log(`✅ User found:`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${user.user_metadata?.role || 'unknown'}`)
    console.log(`   Created: ${user.created_at}`)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2️⃣ FIND USER RECORD IN users TABLE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n2️⃣ FINDING USER RECORD IN users TABLE...\n')
    const { data: userRecord, error: userRecordError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (userRecordError || !userRecord) {
      console.warn(`⚠️  User record not found in users table:`, userRecordError?.message)
    } else {
      console.log(`✅ User record found:`)
      console.log(`   ID: ${userRecord.id}`)
      console.log(`   Role: ${userRecord.role}`)
      console.log(`   Created: ${userRecord.created_at}`)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3️⃣ FIND ARTIST PROFILE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n3️⃣ FINDING ARTIST PROFILE...\n')
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (artistError || !artist) {
      console.warn(`⚠️  Artist profile not found:`, artistError?.message)
      console.log(`   → User is NOT an artist on this account`)
    } else {
      console.log(`✅ Artist profile found:`)
      console.log(`   ID: ${artist.id}`)
      console.log(`   User ID: ${artist.user_id}`)
      console.log(`   Name: ${artist.name}`)
      console.log(`   Status: ${artist.status}`)
      console.log(`   Created: ${artist.created_at}`)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4️⃣ COUNT ARTWORKS — BY DIFFERENT FILTERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n4️⃣ COUNTING ARTWORKS BY DIFFERENT FILTERS...\n')

    // All artworks in system
    const { count: totalArtworks } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })
    console.log(`📊 Total artworks in system: ${totalArtworks}`)

    // By user_id
    const { count: byUserId } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    console.log(`   └─ By user_id (${user.id}): ${byUserId}`)

    // By artist_id (if artist exists)
    let byArtistId = 0
    if (artist?.id) {
      const result = await supabase
        .from('artworks')
        .select('*', { count: 'exact', head: true })
        .eq('artist_id', artist.id)
      byArtistId = result.count
      console.log(`   └─ By artist_id (${artist.id}): ${byArtistId}`)
    }

    // By status=approved
    const { count: byStatusApproved } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
    console.log(`   └─ By status='approved': ${byStatusApproved}`)

    // By status=pending
    const { count: byStatusPending } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    console.log(`   └─ By status='pending': ${byStatusPending}`)

    // By status IS NULL
    const { count: byStatusNull } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .is('status', null)
    console.log(`   └─ By status IS NULL: ${byStatusNull}`)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5️⃣ GET ACTUAL ARTWORKS FOR THIS ARTIST
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n5️⃣ FETCHING ACTUAL ARTWORKS FOR THIS ARTIST...\n')

    if (artist?.id) {
      const { data: artworks, error: artworksError } = await supabase
        .from('artworks')
        .select('id, kucibok_id, title, artist_id, user_id, status, created_at')
        .eq('artist_id', artist.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (artworksError) {
        console.error(`❌ Error fetching artworks:`, artworksError.message)
      } else {
        console.log(`✅ First 10 artworks for artist ${artist.id}:`)
        artworks.forEach((aw, i) => {
          console.log(`   ${i + 1}. ${aw.kucibok_id || aw.id.substring(0, 8)} — "${aw.title}" (status: ${aw.status || 'NULL'})`)
        })

        if (byArtistId > 10) {
          console.log(`   ... and ${byArtistId - 10} more`)
        }
      }
    } else {
      console.log(`⚠️  Cannot fetch — no artist_id`)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6️⃣ TRACE THE FRONTEND LOGIC
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n6️⃣ FRONTEND LOGIC TRACE:\n')
    console.log(`When user logs in as ${email}:`)
    console.log(`1. AuthContext loads user & artist profile`)
    console.log(`   → user._id = ${user.id}`)
    console.log(`   → artistProfile.id = ${artist?.id || 'NOT FOUND ❌'}`)
    console.log(`2. ArtworkContext calls getMyArtworks(artistProfile.id)`)
    console.log(`   → Which calls fetchArtworks({ artist_id: "${artist?.id || 'undefined'}" })`)
    console.log(`   → API endpoint: GET /api/artworks?artist_id=${artist?.id || 'undefined'}`)
    console.log(`3. Backend should filter by artist_id and return ${byArtistId} artworks`)
    console.log(`   → But frontend shows 300 artworks JUMP 0→300 ❌`)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 7️⃣ SIMULATE API CALL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n7️⃣ SIMULATING BACKEND FILTER LOGIC:\n')

    if (artist?.id) {
      console.log(`Filtering by artist_id = "${artist.id}"...`)
      const { data: simulated, error: simError } = await supabase
        .from('artworks')
        .select('id, kucibok_id, title, artist_id, status')
        .eq('artist_id', artist.id)
        .limit(300) // Simulate what backend does

      if (simError) {
        console.error(`❌ Simulation error:`, simError.message)
      } else {
        console.log(`✅ Backend would return: ${simulated.length} artworks`)
        if (simulated.length > 0) {
          console.log(`   First artwork artist_id: ${simulated[0].artist_id}`)
          console.log(`   Does it match filter? ${simulated[0].artist_id === artist.id ? '✅ YES' : '❌ NO'}`)
        }
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 8️⃣ CHECK FOR DUPLICATE/CORRUPTED DATA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n8️⃣ CHECKING FOR DATA ANOMALIES:\n')

    const { data: nullStatusArtworks } = await supabase
      .from('artworks')
      .select('id, title, artist_id, status')
      .is('status', null)
      .limit(5)

    if (nullStatusArtworks && nullStatusArtworks.length > 0) {
      console.warn(`⚠️  Found ${nullStatusArtworks.length} artworks with NULL status!`)
      nullStatusArtworks.forEach(aw => {
        console.log(`   - ${aw.title || 'Untitled'} (artist_id: ${aw.artist_id})`)
      })
    }

    const { data: duplicates } = await supabase
      .from('artworks')
      .select('kucibok_id, count:id.count()', { count: 'exact' })
      .neq('kucibok_id', null)
      .group_by('kucibok_id')
      .having('count > 1')
      .limit(5)

    if (duplicates && duplicates.length > 0) {
      console.warn(`⚠️  Found duplicate kucibok_ids!`)
      duplicates.forEach(d => {
        console.log(`   - ${d.kucibok_id}: ${d.count} copies`)
      })
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SUMMARY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n' + '='.repeat(80))
    console.log('\n📋 AUDIT SUMMARY:\n')
    console.log(`User: ${email}`)
    console.log(`User ID: ${user.id}`)
    console.log(`Artist ID: ${artist?.id || 'NOT FOUND'}`)
    console.log(`Artist's artworks: ${byArtistId}`)
    console.log(`Total artworks in system: ${totalArtworks}`)
    console.log(``)
    console.log(`🐛 BUG HYPOTHESIS:`)
    if (byArtistId === 0) {
      console.log(`   → Artist has 0 artworks, but 300 are showing`)
      console.log(`   → Problem: Filter returning wrong data OR`)
      console.log(`   → Artist ID is null/wrong in the artworks table`)
    } else if (byArtistId < 50) {
      console.log(`   → Artist has ${byArtistId} artworks, but 300 are showing`)
      console.log(`   → Problem: Filter by artist_id is broken`)
    } else {
      console.log(`   → Artist has ${byArtistId} artworks, 300 shown`)
      console.log(`   → Could be limit issue or bad filtering`)
    }
    console.log('\n' + '='.repeat(80) + '\n')

  } catch (error) {
    console.error('❌ Audit error:', error.message)
  }
}

audit()
