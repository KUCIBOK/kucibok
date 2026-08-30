#!/usr/bin/env node
/**
 * List all users in Supabase auth.users
 * Usage: node list-all-users.js
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

async function listAllUsers() {
  console.log('📋 Listing all users in auth.users...\n')

  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('❌ Error fetching users:', error.message)
      return
    }

    if (!users || users.length === 0) {
      console.log('❌ No users found in Supabase')
      return
    }

    console.log(`✅ Found ${users.length} user(s):\n`)
    console.log('Email'.padEnd(40) + 'Role'.padEnd(20) + 'Email Verified')
    console.log('─'.repeat(70))

    users.forEach((user, index) => {
      const role = user.user_metadata?.role || 'buyer'
      const verified = user.email_confirmed_at ? '✅ Yes' : '❌ No'
      console.log(
        (user.email || 'No email').padEnd(40) +
        role.padEnd(20) +
        verified
      )
    })

    console.log('\n' + '─'.repeat(70))
    console.log('\n💡 If you don\'t see your email, you need to create an account first.')
    console.log('   Or use one of the existing emails above.\n')

  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

listAllUsers()
