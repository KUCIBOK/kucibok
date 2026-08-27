#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fix() {
  const EMAIL = "kucibok221@gmail.com";
  console.log(`🔧 FIXING EMAIL VERIFICATION FOR: ${EMAIL}\n`);
  console.log("=".repeat(60) + "\n");

  try {
    // 1. Find user by email via admin list
    console.log("1️⃣ Finding user in auth.users...\n");

    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    const user = allUsers.users.find(u => u.email === EMAIL);

    if (!user) {
      console.log(`❌ User ${EMAIL} not found in auth.users\n`);
      return;
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email verified: ${!!user.email_confirmed_at ? '✅ YES' : '❌ NO'}`);
    console.log(`   Identities: ${user.identities?.map(i => i.provider).join(', ') || 'none'}\n`);

    // 2. If not verified, verify it
    if (!user.email_confirmed_at) {
      console.log("2️⃣ Confirming email...\n");

      const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );

      if (updateError) {
        console.log(`❌ Error: ${updateError.message}\n`);
        return;
      }

      console.log(`✅ Email confirmed!\n`);
    } else {
      console.log("✅ Email already confirmed\n");
    }

    // 3. Test login
    console.log("3️⃣ Testing login...\n");

    console.log(`Try logging in with:`);
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: [your password]\n`);

    console.log("=".repeat(60) + "\n");
    console.log("✅ READY TO LOGIN!\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

fix();
