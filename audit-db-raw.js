#!/usr/bin/env node
/**
 * audit-db-raw.js — Raw database audit (no filtering by user/artist)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.local or .env
const envLocalPath = path.join(__dirname, '.env.local')
const envPath = path.join(__dirname, '.env')
const pathToLoad = fs.existsSync(envLocalPath) ? envLocalPath : envPath

if (fs.existsSync(pathToLoad)) {
  const envContent = fs.readFileSync(pathToLoad, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/)
    if (match) {
      const key = match[1]
      const value = match[2].replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

const { createClient } = await import('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log('📊 RAW DATABASE AUDIT\n')

async function audit() {
  try {
    // 1️⃣ Total users
    console.log('1️⃣  Counting users...')
    const { data: users, error: usersError, count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    console.log(`   Total users: ${userCount || 0}`)

    // 2️⃣ Total artists
    console.log('\n2️⃣  Counting artists...')
    const { data: artists, error: artistsError, count: artistCount } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true })

    console.log(`   Total artists: ${artistCount || 0}`)

    // 3️⃣ Total artworks
    console.log('\n3️⃣  Counting artworks...')
    const { data: artworks, count: artworkCount } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })

    console.log(`   Total artworks: ${artworkCount || 0}`)

    // 4️⃣ Sample artworks (first 10)
    console.log('\n4️⃣  Sample artworks (first 10):')
    const { data: sampleArtworks } = await supabase
      .from('artworks')
      .select('id, title, artist_id, user_id, status')
      .limit(10)

    sampleArtworks?.forEach((a, i) => {
      console.log(`   [${i + 1}] "${a.title}"`)
      console.log(`       artist_id: ${a.artist_id}`)
      console.log(`       user_id:   ${a.user_id}`)
      console.log(`       status:    ${a.status}`)
    })

    // 5️⃣ Check for NULL artist_ids
    console.log('\n5️⃣  Checking for NULL artist_ids...')
    const { data: nullArtistIdArtworks, count: nullArtistIdCount } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .is('artist_id', null)

    console.log(`   Artworks with NULL artist_id: ${nullArtistIdCount || 0}`)

    // 6️⃣ Unique artist_ids in artworks table
    console.log('\n6️⃣  Unique artist_ids in artworks...')
    const { data: allArtworks } = await supabase
      .from('artworks')
      .select('artist_id')

    const uniqueArtistIds = new Set(allArtworks?.map(a => a.artist_id).filter(Boolean))
    console.log(`   Unique non-NULL artist_ids: ${uniqueArtistIds.size}`)

    if (uniqueArtistIds.size <= 20) {
      console.log('   List:')
      uniqueArtistIds.forEach(id => console.log(`      - ${id}`))
    } else {
      console.log('   (too many to list)')
    }

    // 7️⃣ Check if artists exist for these IDs
    console.log('\n7️⃣  Checking artist records for these IDs...')
    if (uniqueArtistIds.size > 0) {
      const artistIds = Array.from(uniqueArtistIds)
      const { data: existingArtists, count: existingArtistCount } = await supabase
        .from('artists')
        .select('id', { count: 'exact' })
        .in('id', artistIds)

      console.log(`   Artists found: ${existingArtistCount || 0} / ${artistIds.length}`)

      if (existingArtistCount === 0) {
        console.log('   🚨 CRITICAL: NO artists found for any artwork!')
      }
    }

    console.log('\n' + '='.repeat(70) + '\n')

  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

audit()
