#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log("🔍 Checking for broken FK records...\n");

  // Get all users from public.users
  const { data: publicUsers } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .limit(5);

  console.log("Sample public.users records:");
  publicUsers.forEach(u => console.log(`  - ${u.id} (${u.name})`));
  console.log();

  // Try to get the same users from auth.users
  console.log("Checking if these users exist in auth.users...\n");

  for (const u of publicUsers || []) {
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(u.id);
      if (authUser?.user) {
        console.log(`  ✅ ${u.id} exists in auth.users`);
      } else {
        console.log(`  ❌ ${u.id} NOT in auth.users — BROKEN FK!`);
      }
    } catch (e) {
      console.log(`  ❌ ${u.id} — Error checking: ${e.message}`);
    }
  }

  console.log("\n📋 Summary:");
  console.log("If any are broken, the FK constraint was violated before.");
  console.log("This suggests the FK constraint might be DEFERRABLE or was added after data.\n");

  // Try inserting a user created in auth.users
  console.log("Now testing: Create user in auth, then insert in public...\n");

  const testEmail = `fktest-${Date.now()}@example.com`;
  const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: "Test123!",
    email_confirm: true,
  });

  if (authError) {
    console.log(`❌ Auth user creation failed: ${authError.message}`);
    return;
  }

  console.log(`✅ Created auth user: ${newAuthUser.user.id}`);

  // Now try to insert into public.users
  const { error: insertError } = await supabaseAdmin
    .from('users')
    .insert({ id: newAuthUser.user.id, role: 'buyer', name: 'FK Test' });

  if (insertError) {
    console.log(`❌ Insert to public.users failed: ${insertError.message}`);
    console.log(`   This is the FK constraint blocking new users!\n`);

    // Clean up auth user
    await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
    console.log("   Cleaned up test auth user");
  } else {
    console.log("✅ Insert to public.users succeeded!");
  }
}

check().catch(e => console.error("Error:", e.message));
