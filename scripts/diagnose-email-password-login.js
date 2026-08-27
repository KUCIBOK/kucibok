#!/usr/bin/env node

/**
 * DIAGNOSE: Email + Password Login Issues
 * Tests the complete login flow
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function diagnose() {
  console.log("🔍 DIAGNOSING EMAIL+PASSWORD LOGIN...\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Check auth configuration
    console.log("1️⃣ Checking Supabase Auth Configuration...\n");

    console.log(`   SUPABASE_URL: ${SUPABASE_URL.substring(0, 30)}...`);
    console.log(`   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   SUPABASE_SERVICE_ROLE_KEY: ✅ Set\n`);

    // 2. List available users and their auth methods
    console.log("2️⃣ Checking existing users and their auth methods...\n");

    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();

    const emailAuthUsers = allUsers.users.filter(u => u.identities?.some(i => i.provider === 'email'));
    const oauthUsers = allUsers.users.filter(u => u.identities?.some(i => i.provider !== 'email'));

    console.log(`   Total users: ${allUsers.users.length}`);
    console.log(`   Email+password users: ${emailAuthUsers.length}`);
    console.log(`   OAuth users: ${oauthUsers.length}\n`);

    if (emailAuthUsers.length > 0) {
      console.log("   First 5 email+password users:");
      emailAuthUsers.slice(0, 5).forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.email} - Email verified: ${!!u.email_confirmed_at}`);
      });
      console.log();
    }

    // 3. Test direct password login (using admin)
    console.log("3️⃣ Testing password login with admin API...\n");

    if (emailAuthUsers.length === 0) {
      console.log("   ❌ No email+password users to test\n");
      console.log("   This might be why login fails — no users have email+password!\n");
    } else {
      const testUser = emailAuthUsers[0];
      console.log(`   Testing with: ${testUser.email}`);
      console.log(`   (Note: Password is unknown, so this will fail intentionally)\n`);

      const { data, error } = await supabaseAdmin.auth.admin.signInWithPassword({
        email: testUser.email,
        password: "WrongPassword123!",
      });

      if (error) {
        console.log(`   ✅ API correctly rejects wrong password: "${error.message}"\n`);
      } else {
        console.log("   ❌ Unexpected: Wrong password was accepted!\n");
      }
    }

    // 4. Check Supabase Auth settings
    console.log("4️⃣ Checking Supabase Auth Settings...\n");

    console.log("   Common issues:");
    console.log("   - Email+password auth disabled in Supabase console? ❓");
    console.log("   - Email confirmation required? Check if users verified emails");
    console.log("   - Rate limiting active? Check Supabase logs\n");

    // 5. Check what auth methods are configured
    console.log("5️⃣ Frontend vs Backend Approaches:\n");

    console.log("   Frontend (what users see):");
    console.log("   └─ Uses: supabase.auth.signInWithPassword()");
    console.log("   └─ Requires: email verified ✅");
    console.log("   └─ Requires: correct password ✅");
    console.log("   └─ Can fail if: CORS issues, session invalid, bad credentials\n");

    console.log("   Backend (new API route):");
    console.log("   └─ Uses: POST /api/auth/signin");
    console.log("   └─ Uses: supabaseAdmin.auth.admin.signInWithPassword()");
    console.log("   └─ Returns: { session, user }\n");

    // 6. Summary
    console.log("=".repeat(80) + "\n");
    console.log("📊 SUMMARY:\n");

    console.log(`   Email+password users in system: ${emailAuthUsers.length}`);
    console.log(`   Users with verified emails: ${emailAuthUsers.filter(u => !!u.email_confirmed_at).length}`);

    if (emailAuthUsers.length === 0) {
      console.log("\n   🔴 PROBLEM: No email+password users exist!");
      console.log("   → All users are OAuth only (Google Sign-in)\n");
    } else {
      const verified = emailAuthUsers.filter(u => !!u.email_confirmed_at);
      if (verified.length === 0) {
        console.log("\n   🔴 PROBLEM: Email+password users exist but NO verified emails!");
        console.log("   → Users cannot login because emails aren't verified\n");
      } else {
        console.log("\n   ✅ Email+password users with verified emails DO exist");
        console.log("   → The issue might be:");
        console.log("      • Rate limiting on Supabase Auth");
        console.log("      • Client-side session handling");
        console.log("      • Browser localStorage/cookie issues\n");
      }
    }

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

diagnose();
