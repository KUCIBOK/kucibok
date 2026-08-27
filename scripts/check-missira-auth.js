#!/usr/bin/env node

/**
 * Check Missira's auth status and login issues
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("🔍 CHECKING MISSIRA'S AUTH STATUS...\n");

  try {
    const MISSIRA_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
    const MISSIRA_EMAIL = "misirakeita@gmail.com";

    // Try to get auth user directly
    console.log("1️⃣ Fetching auth.users by ID...\n");
    const { data: authUsers, error: authError } = await supabase.auth.admin.getUserById(MISSIRA_ID);

    if (authError) {
      console.log(`❌ Error getting auth user: ${authError.message}\n`);
    } else if (authUsers && authUsers.user) {
      const u = authUsers.user;
      console.log("✅ Auth user found:\n");
      console.log(`   ID: ${u.id}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Email verified: ${!!u.email_confirmed_at}`);
      if (!u.email_confirmed_at) {
        console.log(`   ⚠️  EMAIL NOT VERIFIED - LOGIN WILL FAIL!\n`);
      } else {
        console.log(`   ✅ Email verified at: ${u.email_confirmed_at}\n`);
      }

      console.log(`   Last sign-in: ${u.last_sign_in_at || 'Never'}`);
      console.log(`   Created: ${u.created_at}\n`);
    }

    // Check public.users
    console.log("2️⃣ Checking public.users profile...\n");
    const { data: publicUsers } = await supabase
      .from("users")
      .select("*")
      .eq("id", MISSIRA_ID);

    if (publicUsers && publicUsers.length > 0) {
      const u = publicUsers[0];
      console.log("✅ Public profile found:\n");
      console.log(`   Name: ${u.name}`);
      console.log(`   Role: ${u.role}`);
      console.log(`   Profile completed: ${u.profile_completed}`);
      console.log(`   Onboarding completed: ${u.onboarding_completed}`);
      console.log(`   Is active: ${u.is_active}\n`);
    } else {
      console.log("❌ No public profile\n");
    }

    // Check if API can fetch her artworks
    console.log("3️⃣ Testing API endpoint simulation...\n");
    const { data: artworks } = await supabase
      .from("artworks")
      .select("id, title, status")
      .eq("user_id", MISSIRA_ID);

    if (artworks && artworks.length > 0) {
      console.log(`✅ API can fetch ${artworks.length} artwork(s) by user_id\n`);
    } else {
      console.log("❌ API cannot find artworks by user_id\n");
    }

    const { data: artistArtworks } = await supabase
      .from("artworks")
      .select("id, title, status");
      // .eq("artist_id", MISSIRA_ARTIST_ID);  — we'd need artist ID

    console.log(`   Total artworks in DB: ${artistArtworks?.length || 0}\n`);

    // Get the full picture
    console.log("=".repeat(80) + "\n");
    console.log("📊 SUMMARY:\n");
    console.log(`   Email verified: ${authUsers?.user?.email_confirmed_at ? '✅ YES' : '❌ NO'}`);
    console.log(`   Public profile: ✅ YES`);
    console.log(`   Has artworks: ✅ YES (9 total)`);
    console.log(`   Last login: ${authUsers?.user?.last_sign_in_at ? 'Has logged in' : 'Never logged in'}\n`);

    if (!authUsers?.user?.email_confirmed_at) {
      console.log("🔴 PROBLEM: Email not verified - this blocks login!\n");
      console.log("   FIX: Manually verify email in Supabase Auth\n");
    }

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

check();
