#!/usr/bin/env node
/**
 * Update user role to admin for kucibok221@gmail.com
 * Usage: node update-admin-role.js
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

async function updateAdminRole() {
  console.log('🔄 Updating role to "admin" for kucibok221@gmail.com...\n')

  try {
    // First, find the user in auth.users by email
    console.log('📋 Finding user in auth.users...')
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      return
    }

    const authUser = users.find(u => u.email === 'kucibok221@gmail.com')
    if (!authUser) {
      console.error('❌ User not found in auth.users')
      return
    }

    console.log('✅ User found: ID', authUser.id)

    // Update in auth.users user_metadata
    console.log('\n📝 Updating auth.users metadata...')
    const { data: updatedAuth, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { user_metadata: { ...authUser.user_metadata, role: 'admin' } }
    )

    if (authError) {
      console.error('❌ Error updating auth metadata:', authError.message)
      return
    }

    console.log('✅ Updated auth.users metadata:')
    console.log('   ID:', updatedAuth.id)
    console.log('   Role:', updatedAuth.user_metadata?.role)

    // Update in public.users table
    console.log('\n📝 Updating public.users...')
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ role: 'admin' })
      .eq('id', authUser.id)
      .select()

    if (updateError) {
      console.error('❌ Error updating profile:', updateError.message)
      return
    }

    if (!updatedProfile || updatedProfile.length === 0) {
      console.error('❌ User not found in public.users')
      return
    }

    console.log('✅ Updated in public.users:')
    console.log('   ID:', updatedProfile[0].id)
    console.log('   Name:', updatedProfile[0].name)
    console.log('   New Role:', updatedProfile[0].role)

    console.log('\n' + '='.repeat(50))
    console.log('✅ SUCCESS: Role updated to "admin"!')
    console.log('   You can now access the Users dashboard.')
    console.log('='.repeat(50))

  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

updateAdminRole()
