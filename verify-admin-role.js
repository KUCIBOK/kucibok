#!/usr/bin/env node
/**
 * Verify admin role for kucibok221@gmail.com
 * Usage: node verify-admin-role.js
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
  console.error('Make sure your .env file has these variables set')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function verifyAdminRole() {
  console.log('🔍 Checking admin role for kucibok221@gmail.com...\n')

  try {
    // First, find the user in auth.users by email
    console.log('📋 Fetching from auth.users table...')
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching auth users:', authError.message)
      return
    }

    const authUser = users.find(u => u.email === 'kucibok221@gmail.com')
    if (!authUser) {
      console.error('❌ User not found in auth.users')
      console.error('   Email: kucibok221@gmail.com')
      return
    }

    console.log('✅ User found in auth.users:')
    console.log('   ID:', authUser.id)
    console.log('   Email:', authUser.email)
    console.log('   Email verified:', authUser.email_confirmed_at ? '✅ Yes' : '❌ No')
    console.log('   Role (metadata):', authUser.user_metadata?.role || 'Not set')
    console.log('   Created:', authUser.created_at)

    // Now check in public.users table using the auth user ID
    console.log('\n📋 Fetching from public.users table...')
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, name, role, created_at, is_active')
      .eq('id', authUser.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error fetching profile:', profileError.message)
      return
    }

    if (!userProfile) {
      console.error('❌ User not found in public.users table')
      console.error('   ID:', authUser.id)
      return
    }

    console.log('✅ User found in public.users:')
    console.log('   ID:', userProfile.id)
    console.log('   Name:', userProfile.name)
    console.log('   Role:', userProfile.role)
    console.log('   Active:', userProfile.is_active)
    console.log('   Created:', userProfile.created_at)

    // Summary
    console.log('\n' + '='.repeat(50))
    if (userProfile.role === 'admin') {
      console.log('✅ SUCCESS: You ARE an admin!')
      console.log('   The Users dashboard should now work.')
    } else if (userProfile.role === 'superadmin') {
      console.log('✅ SUCCESS: You ARE a superadmin!')
      console.log('   The Users dashboard should now work.')
    } else {
      console.log(`⚠️  WARNING: Your role is "${userProfile.role}", not "admin"`)
      console.log('   You need to update your role to "admin" or "superadmin"')
      console.log('\n   Run this command to fix it:')
      console.log(`   node update-admin-role.js`)
    }
    console.log('='.repeat(50))

  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

verifyAdminRole()
