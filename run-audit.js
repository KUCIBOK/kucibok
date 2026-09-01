#!/usr/bin/env node
/**
 * run-audit.js — Load .env and run audit script
 * Usage: node run-audit.js <artist_id>
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.local or .env file
const envLocalPath = path.join(__dirname, '.env.local')
const envPath = path.join(__dirname, '.env')
const pathToLoad = fs.existsSync(envLocalPath) ? envLocalPath : envPath

if (fs.existsSync(pathToLoad)) {
  const envContent = fs.readFileSync(pathToLoad, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/)
    if (match) {
      const key = match[1]
      const value = match[2].replace(/^["']|["']$/g, '') // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
  console.log(`✅ Loaded ${fs.existsSync(envLocalPath) ? '.env.local' : '.env'} file\n`)
}

// Now run the audit
const { createClient } = await import('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL not found in .env')
  process.exit(1)
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const artistId = process.argv[2]
if (!artistId) {
  console.error('❌ Missing artist_id argument')
  console.error('Usage: node run-audit.js <artist_id>')
  process.exit(1)
}

console.log(`📊 AUDIT: Artist Artworks for ${artistId}\n`)

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

    // 3️⃣ Verify artworks
    if (artworks && artworks.length > 0) {
      console.log('\n3️⃣  Verifying artworks...')
      const allMatch = artworks.every(a => a.artist_id === artistId)
      console.log(`   ${allMatch ? '✅' : '❌'} All artworks have correct artist_id: ${allMatch ? 'YES' : 'NO'}`)

      // Show sample
      console.log('\n4️⃣  Sample artworks:')
      artworks.slice(0, 5).forEach((a, i) => {
        console.log(`   [${i + 1}] "${a.title}" (${a.status})`)
      })
      if (artworks.length > 5) console.log(`   ... and ${artworks.length - 5} more`)

      // 5️⃣ DIAGNOSIS
      console.log('\n' + '='.repeat(70))
      console.log('🔍 DIAGNOSIS:')
      console.log('='.repeat(70))

      if (artworks.length === 0) {
        console.log('✅ HEALTHY: Artist has 0 artworks')
      } else if (artworks.length === 300) {
        console.log('🚨 CRITICAL: Artist has exactly 300 artworks!')
        console.log('   → DATABASE CORRUPTION detected during migration')
        console.log('   → All 300 artworks incorrectly linked to this artist')
        console.log('\n   🔧 NEXT STEPS:')
        console.log('   1. Verify artworks in Supabase dashboard')
        console.log('   2. Find the correct artist_id for each artwork')
        console.log('   3. Run a bulk UPDATE to fix artist_id values')
      } else if (artworks.length <= 50) {
        console.log(`✅ NORMAL: Artist has ${artworks.length} artworks (healthy)`)
      } else {
        console.log(`⚠️  SUSPICIOUS: Artist has ${artworks.length} artworks`)
      }

      // Check user_id consistency
      console.log('\n5️⃣  User ID consistency:')
      const userIds = new Set(artworks.map(a => a.user_id))
      const artistUserId = artist.user_id
      if (userIds.size === 1) {
        const uid = Array.from(userIds)[0]
        if (uid === artistUserId) {
          console.log(`   ✅ All artworks linked to user ${uid} (correct)`)
        } else {
          console.log(`   ❌ MISMATCH: Artworks have user_id ${uid}, artist has ${artistUserId}`)
        }
      } else {
        console.log(`   ❌ INCONSISTENT: ${userIds.size} different user_ids`)
        userIds.forEach(uid => console.log(`      - ${uid}`))
      }
    } else {
      console.log('✅ Artist has 0 artworks (healthy)')
    }

    console.log('\n' + '='.repeat(70) + '\n')

  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

audit()
