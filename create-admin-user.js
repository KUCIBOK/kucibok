#!/usr/bin/env node
/**
 * Create a new admin user in Supabase
 * Usage: node create-admin-user.js
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, resolve)
  })
}

async function createAdminUser() {
  console.log('🔑 Create New Admin User\n')
  console.log('This will create a new admin account in Supabase.\n')

  try {
    // Get user inputs
    const email = await prompt('Email: ')
    const password = await prompt('Password (min 8 chars): ')
    const name = await prompt('Full Name: ')

    // Validate
    if (!email || !password || !name) {
      console.error('❌ All fields are required')
      rl.close()
      return
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters')
      rl.close()
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format')
      rl.close()
      return
    }

    console.log('\n📝 Creating admin user...\n')

    // Create auth user
    console.log('  1️⃣  Creating auth.users entry...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm admin accounts
      user_metadata: {
        role: 'admin',
        name: name,
      },
    })

    if (authError) {
      console.error('  ❌ Error creating auth user:', authError.message)
      rl.close()
      return
    }

    console.log('  ✅ auth.users entry created')
    const userId = authData.user.id

    // Create public.users profile
    console.log('  2️⃣  Creating public.users profile...')
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        role: 'admin',
        name: name,
        auth_provider: 'email',
        is_active: true,
      })
      .select()

    if (profileError) {
      console.error('  ❌ Error creating profile:', profileError.message)
      // Note: Auth user created but profile failed
      rl.close()
      return
    }

    console.log('  ✅ public.users profile created')

    // Success!
    console.log('\n' + '='.repeat(60))
    console.log('✅ SUCCESS: Admin user created!\n')
    console.log('Details:')
    console.log('  Email:  ', email)
    console.log('  Name:   ', name)
    console.log('  Role:   ', 'admin')
    console.log('  UserID: ', userId)
    console.log('  Status: ', 'Active & Email Verified')
    console.log('\n💡 You can now log in and access the admin dashboard.')
    console.log('='.repeat(60))

  } catch (err) {
    console.error('❌ Exception:', err.message)
  }

  rl.close()
}

createAdminUser()
