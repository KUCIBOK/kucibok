#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function test() {
  console.log("Testing: Unconfirmed user → public.users insert\n");

  const testEmail = `unconfirmed-${Date.now()}@example.com`;

  // Create UNconfirmed user (like signup does)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: "Test123!",
    email_confirm: false,  // ← Key difference
  });

  if (authError) {
    console.log(`❌ Auth user creation failed: ${authError.message}`);
    return;
  }

  console.log(`✅ Created UNconfirmed auth user: ${authData.user.id}\n`);

  // Try to insert into public.users
  console.log("Attempting insert to public.users...\n");

  const { error: insertError, data: insertData } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      role: 'buyer',
      name: testEmail.split('@')[0],
      country: null,
      institution: null,
    });

  if (insertError) {
    console.log(`❌ Insert failed: ${insertError.message}`);
    console.log(`   Code: ${insertError.code}`);

    // Clean up
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
  } else {
    console.log(`✅ Insert succeeded!`);
    console.log(`   Data:`, insertData);
  }
}

test().catch(e => console.error("Error:", e.message));
