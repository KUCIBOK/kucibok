#!/usr/bin/env node

/**
 * DIAGNOSE: Why email+password login fails
 */

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function diagnose(email) {
  console.log(`\n🔍 DIAGNOSING LOGIN FOR: ${email}\n`);
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Check if user exists in auth.users
    console.log("1️⃣ Checking auth.users...\n");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      // We don't have the ID, so we need to list users and find by email
      // This is a limitation of the admin API
    ).catch(() => ({ data: null }));

    // Alternative: try to login and see the error
    console.log("2️⃣ Attempting login to see error message...\n");

    const { data: sessionData, error: loginError } = await supabaseAdmin.auth.admin.signInWithPassword({
      email: email,
      password: "WrongPassword123!", // Intentionally wrong
    });

    if (loginError) {
      console.log(`   Error: ${loginError.message}\n`);

      if (loginError.message.includes("Invalid login credentials")) {
        console.log("   ⚠️  User not found OR password is wrong");
        console.log("   → Check if user exists in auth.users");
        console.log("   → Check if email is verified\n");
      } else if (loginError.message.includes("not confirmed")) {
        console.log("   🔴 Email not confirmed!");
        console.log("   → User must click the verification link first\n");
      }
    }

    // 3. Query public.users to see if profile exists
    console.log("3️⃣ Checking public.users profile...\n");

    const { data: publicUsers } = await supabaseAdmin
      .from('users')
      .select('id, name, role, created_at')
      .ilike('name', email.split('@')[0]); // Try to find by partial name

    if (publicUsers && publicUsers.length > 0) {
      console.log(`   ✅ Found public profile:\n`);
      publicUsers.forEach(u => {
        console.log(`      ID: ${u.id}`);
        console.log(`      Name: ${u.name}`);
        console.log(`      Role: ${u.role}`);
        console.log(`      Created: ${u.created_at}\n`);
      });
    } else {
      console.log(`   ❌ No public.users profile found\n`);
    }

    // 4. Summary
    console.log("=".repeat(80) + "\n");
    console.log("📊 POSSIBLE CAUSES:\n");
    console.log("1. ❌ Email not verified (user didn't click verification link)");
    console.log("2. ❌ Password is incorrect (typo?)");
    console.log("3. ❌ User doesn't exist in auth.users");
    console.log("4. ❌ Rate limiting (too many login attempts)\n");

    console.log("SOLUTION:");
    console.log("→ Ask user to check their email for verification link");
    console.log("→ If no email received, check spam folder");
    console.log("→ Double-check password (case-sensitive)\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

// Test with email passed as argument
const email = process.argv[2] || "misirakeita@gmail.com";
diagnose(email);
