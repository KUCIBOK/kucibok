#!/usr/bin/env node
/**
 * audit-by-user.js — Audit artworks by user_id instead of artist_id
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
  console.log(`✅ Loaded ${fs.existsSync(envLocalPath) ? '.env.local' : '.env'} file\n`)
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

const userId = process.argv[2]
if (!userId) {
  console.error('❌ Missing user_id argument')
  console.error('Usage: node audit-by-user.js <user_id>')
  process.exit(1)
}

console.log(`📊 AUDIT: User Artworks for ${userId}\n`)

async function audit() {
  try {
    // 1️⃣ Get user info
    console.log('1️⃣  Fetching user...')
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('❌ User not found:', userError?.message)
      return
    }
    console.log(`   ✅ User: ${user.email} (role: ${user.role})`)

    // 2️⃣ Get artist profile for this user
    console.log('\n2️⃣  Fetching artist profile...')
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, name')
      .eq('user_id', userId)
      .single()

    if (artistError) {
      console.warn(`   ⚠️  No artist profile found for this user`)
    } else {
      console.log(`   ✅ Artist: ${artist.name || 'Unnamed'} (ID: ${artist.id})`)
    }

    // 3️⃣ Count artworks by user_id
    console.log('\n3️⃣  Counting artworks by user_id...')
    const { data: artworksByUser, error: userArtworksError } = await supabase
      .from('artworks')
      .select('id, title, artist_id, user_id, status', { count: 'exact' })
      .eq('user_id', userId)

    if (userArtworksError) {
      console.error('❌ Query error:', userArtworksError.message)
      return
    }

    console.log(`   ✅ Found ${artworksByUser?.length || 0} artworks with user_id = ${userId}`)

    // 4️⃣ Count artworks by artist_id (if artist exists)
    let artworksByArtist = []
    if (artist?.id) {
      console.log('\n4️⃣  Counting artworks by artist_id...')
      const { data: artworks, error: artistArtworksError } = await supabase
        .from('artworks')
        .select('id, title, artist_id, user_id, status', { count: 'exact' })
        .eq('artist_id', artist.id)

      if (artistArtworksError) {
        console.error('❌ Query error:', artistArtworksError.message)
      } else {
        artworksByArtist = artworks || []
        console.log(`   ✅ Found ${artworksByArtist.length} artworks with artist_id = ${artist.id}`)
      }
    }

    // 5️⃣ DIAGNOSIS
    console.log('\n' + '='.repeat(70))
    console.log('🔍 DIAGNOSIS:')
    console.log('='.repeat(70))

    const userArtworkCount = artworksByUser?.length || 0
    const artistArtworkCount = artworksByArtist.length

    if (userArtworkCount === 0 && artistArtworkCount === 0) {
      console.log('✅ HEALTHY: User has 0 artworks (expected for new user)')
    } else if (userArtworkCount === 300 && artistArtworkCount === 0) {
      console.log('🚨 CRITICAL: Found 300 artworks by user_id, 0 by artist_id!')
      console.log('   → The artist record exists but has wrong ID in artworks')
      console.log('   → OR artworks were created before artist record existed')
      console.log('   → SOLUTION: Update artworks.artist_id to match the artist record')
    } else if (userArtworkCount === 300 && artistArtworkCount === 300) {
      console.log('🚨 CRITICAL: 300 artworks by user_id AND 300 by artist_id!')
      console.log('   → Database corruption: artworks linked to this artist_id')
      console.log('   → User never uploaded 300 artworks manually')
    } else if (userArtworkCount === 0 && artistArtworkCount > 0) {
      console.log(`⚠️  MISMATCH: ${artistArtworkCount} artworks by artist_id, 0 by user_id`)
      console.log('   → Artworks have wrong user_id')
    } else if (userArtworkCount === artistArtworkCount && userArtworkCount > 0) {
      console.log(`✅ CONSISTENT: Both user_id and artist_id match (${userArtworkCount} artworks)`)
    } else {
      console.log(`⚠️  INCONSISTENT: user_id=${userArtworkCount}, artist_id=${artistArtworkCount}`)
    }

    console.log('\n' + '='.repeat(70) + '\n')

  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

audit()
