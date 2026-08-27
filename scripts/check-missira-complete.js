#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  const EMAIL = "misirakeita@gmail.com";
  const ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";

  console.log(`🔍 COMPLETE CHECK FOR MISSIRA\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Get Missira's auth account
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(ID);
    const user = authData?.user;

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("1️⃣ AUTH ACCOUNT:\n");
    console.log(`   Email: ${user.email}`);
    console.log(`   Email confirmed: ${user.email_confirmed_at ? '✅ YES' : '❌ NO'}`);
    console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);
    console.log(`   Created: ${user.created_at}\n`);

    console.log("2️⃣ IDENTITIES (Auth Methods):\n");
    if (user.identities && user.identities.length > 0) {
      user.identities.forEach((id, i) => {
        console.log(`   ${i + 1}. ${id.provider}`);
        if (id.provider === 'email') {
          console.log(`      ✅ HAS EMAIL+PASSWORD`);
        } else if (id.provider === 'google') {
          console.log(`      → Google OAuth`);
        }
      });
      console.log();
    }

    console.log("3️⃣ PUBLIC PROFILE:\n");
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', ID)
      .single();

    if (profile) {
      console.log(`   Name: ${profile.name}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Is Active: ${profile.is_active}`);
      console.log();
    }

    console.log("4️⃣ DIAGNOSIS:\n");

    if (!user.email_confirmed_at) {
      console.log(`   🔴 EMAIL NOT CONFIRMED`);
      console.log(`   → This blocks login!\n`);
      console.log(`   FIX: Need to confirm email`);
    } else if (!user.identities?.some(i => i.provider === 'email')) {
      console.log(`   🔴 NO EMAIL+PASSWORD IDENTITY`);
      console.log(`   → She only has Google OAuth\n`);
      console.log(`   FIX: Need to add email+password`);
    } else {
      console.log(`   ✅ Email confirmed: YES`);
      console.log(`   ✅ Has email+password: YES`);
      console.log(`   ✅ Everything should work!\n`);
      console.log(`   🤔 LOGIN SHOULD WORK`);
      console.log(`   → If it doesn't, the problem is in the login endpoint\n`);
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

check();
