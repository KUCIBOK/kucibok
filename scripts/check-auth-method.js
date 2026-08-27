#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log("Checking authentication methods...\n");

  const MISSIRA_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
  const MISSIRA_EMAIL = "misirakeita@gmail.com";

  try {
    // Get Missira's auth user
    const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(MISSIRA_ID);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }

    if (!authUser?.user) {
      console.log("❌ User not found");
      return;
    }

    const user = authUser.user;

    console.log(`👤 Missira Keita (${MISSIRA_EMAIL})\n`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email verified: ${!!user.email_confirmed_at ? '✅ YES' : '❌ NO'}\n`);

    console.log("Authentication Identities:\n");

    if (user.identities && user.identities.length > 0) {
      user.identities.forEach((identity, i) => {
        console.log(`   ${i + 1}. Provider: ${identity.provider}`);
        if (identity.provider === 'google') {
          console.log(`      → Google OAuth connected`);
        } else if (identity.provider === 'email') {
          console.log(`      → Email+Password (has password hash)`);
        }
        console.log(`      Created: ${identity.created_at}\n`);
      });
    } else {
      console.log("   ⚠️  No identities found (unusual)\n");
    }

    console.log("=".repeat(60) + "\n");

    // Check if she has password-based auth
    const hasEmailPassword = user.identities?.some(i => i.provider === 'email');
    const hasGoogle = user.identities?.some(i => i.provider === 'google');

    console.log("📊 AUTHENTICATION SUMMARY:\n");
    console.log(`   Can login with Google: ${hasGoogle ? '✅ YES' : '❌ NO'}`);
    console.log(`   Can login with Email+Password: ${hasEmailPassword ? '✅ YES' : '❌ NO'}\n`);

    if (!hasEmailPassword && hasGoogle) {
      console.log("🔴 PROBLEM:\n");
      console.log("   Missira only has Google OAuth, not email+password!");
      console.log("   She registered via Google, never set a password.\n");
      console.log("   SOLUTION:\n");
      console.log("   1. She must login via GOOGLE (which works)\n");
      console.log("   OR\n");
      console.log("   2. Reset password via 'Forgot Password' to set one\n");
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

check();
