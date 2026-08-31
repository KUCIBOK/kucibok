#!/usr/bin/env node
/**
 * Search for a user by email (handles pagination)
 * Usage: node search-user.js <email>
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local manually
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
      }
    }
  })
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function searchUser() {
  const email = process.argv[2] || 'kucibok221@gmail.com'

  console.log(`🔍 Searching for ${email}...\n`)

  try {
    // Search with pagination
    let foundUser = null
    let pageStart = 0
    const pageSize = 100

    while (true) {
      console.log(`  Checking page (${pageStart}-${pageStart + pageSize})...`)

      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        perPage: pageSize,
        page: Math.floor(pageStart / pageSize),
      })

      if (error) {
        console.error('❌ Error listing users:', error.message)
        return
      }

      if (!users || users.length === 0) {
        console.log('  (no more users)')
        break
      }

      foundUser = users.find(u => u.email === email)
      if (foundUser) {
        console.log(`  ✅ Found on this page!`)
        break
      }

      pageStart += pageSize
    }

    if (!foundUser) {
      console.error(`❌ User not found: ${email}`)
      return
    }

    console.log('\n✅ User found:\n')
    console.log('  Email:         ', foundUser.email)
    console.log('  ID:            ', foundUser.id)
    console.log('  Role (meta):   ', foundUser.user_metadata?.role || 'Not set')
    console.log('  Email verified:', foundUser.email_confirmed_at ? '✅ Yes' : '❌ No')
    console.log('  Created:       ', foundUser.created_at)

  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

searchUser()
