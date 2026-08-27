#!/usr/bin/env node

/**
 * QUICK TEST: Email+Password Signup & Login Flow
 * Run this AFTER deploying to verify the fix works
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function test() {
  console.log("🧪 TESTING EMAIL+PASSWORD FIX...\n");
  console.log("=".repeat(80) + "\n");

  const TEST_EMAIL = `test-${Date.now()}@example.com`;
  const TEST_PASSWORD = "TestPassword123!";

  try {
    // 1. Create a test user programmatically
    console.log("1️⃣ Creating test user via auth admin...\n");
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Password: [hidden]\n`);

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true, // Auto-confirm for testing
      user_metadata: {
        role: 'artist',
        name: 'Test User',
      },
    });

    if (createError) {
      console.log(`   ❌ Failed to create user: ${createError.message}\n`);
      return;
    }

    const userId = createData.user.id;
    console.log(`   ✅ User created with ID: ${userId}\n`);

    // 2. Check if public.users profile was created
    console.log("2️⃣ Checking if public.users profile was created...\n");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.log(`   ❌ Profile not found: ${profileError.message}`);
      console.log(`      THIS IS BAD — the fix didn't work!\n`);
      return;
    }

    if (!profile) {
      console.log(`   ❌ Profile returned null`);
      console.log(`      THIS IS BAD — the fix didn't work!\n`);
      return;
    }

    console.log(`   ✅ Profile created successfully:`);
    console.log(`      ID: ${profile.id}`);
    console.log(`      Name: ${profile.name}`);
    console.log(`      Role: ${profile.role}\n`);

    // 3. Try to login with email+password
    console.log("3️⃣ Testing login with email+password...\n");

    const { data: sessionData, error: loginError } = await supabaseAdmin.auth.admin.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (loginError) {
      console.log(`   ❌ Login failed: ${loginError.message}\n`);
      return;
    }

    if (!sessionData.session) {
      console.log(`   ❌ No session returned\n`);
      return;
    }

    console.log(`   ✅ Login successful!`);
    console.log(`      Access token: ${sessionData.session.access_token.substring(0, 20)}...`);
    console.log(`      Expires in: ${sessionData.session.expires_in}s\n`);

    // 4. Cleanup
    console.log("4️⃣ Cleaning up test user...\n");

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.log(`   ⚠️  Could not delete: ${deleteError.message}\n`);
    } else {
      console.log(`   ✅ Test user deleted\n`);
    }

    // 5. Summary
    console.log("=".repeat(80) + "\n");
    console.log("✅ ALL TESTS PASSED!\n");
    console.log("   Email+password signup & login flow is working correctly.\n");

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

test();
