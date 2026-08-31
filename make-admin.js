#!/usr/bin/env node
/**
 * Make an existing user admin
 * Usage: node make-admin.js <email>
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

async function makeAdmin() {
  const email = process.argv[2] || 'kucibok221@gmail.com'

  console.log(`🔑 Making ${email} an admin...\n`)

  try {
    // Find user in auth.users
    console.log('📋 Finding user in auth.users...')
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      return
    }

    const authUser = users.find(u => u.email === email)
    if (!authUser) {
      console.error(`❌ User not found: ${email}`)
      return
    }

    console.log(`✅ Found user: ${authUser.id}`)

    // Update auth.users metadata
    console.log('\n📝 Updating auth.users...')
    const { data: updatedAuth, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      {
        user_metadata: {
          ...authUser.user_metadata,
          role: 'admin',
        },
      }
    )

    if (authError) {
      console.error('❌ Error updating auth user:', authError.message)
      return
    }

    console.log('✅ Updated auth.users metadata')

    // Check if user exists in public.users
    console.log('\n📋 Checking public.users...')
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking profile:', checkError.message)
      return
    }

    if (!existingProfile) {
      // Create profile if doesn't exist
      console.log('📝 Creating missing profile in public.users...')
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.id,
          role: 'admin',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Admin',
          auth_provider: 'email',
          is_active: true,
        })
        .select()

      if (createError) {
        console.error('❌ Error creating profile:', createError.message)
        return
      }

      console.log('✅ Created public.users profile')
    } else {
      // Update existing profile
      console.log('📝 Updating public.users...')
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ role: 'admin' })
        .eq('id', authUser.id)
        .select()

      if (updateError) {
        console.error('❌ Error updating profile:', updateError.message)
        return
      }

      console.log('✅ Updated public.users')
    }

    // Success
    console.log('\n' + '='.repeat(60))
    console.log('✅ SUCCESS: User is now an admin!\n')
    console.log('Details:')
    console.log('  Email: ', email)
    console.log('  Role:  ', 'admin')
    console.log('  Status:', 'Active')
    console.log('\n💡 You can now access the admin dashboard.')
    console.log('='.repeat(60))

  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

makeAdmin()
