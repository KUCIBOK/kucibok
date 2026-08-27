#!/usr/bin/env node

/**
 * DIAGNOSE: Check users table structure and find Missira
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  console.log("🔍 DIAGNOSING USERS TABLE...\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Get one user to see columns
    console.log("1️⃣ Fetching first user (no filters)...\n");
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .limit(1);

    if (error) {
      console.log(`❌ Error: ${error.message}\n`);
      return;
    }

    if (!data || data.length === 0) {
      console.log("❌ NO USERS in table\n");
      return;
    }

    const firstUser = data[0];
    console.log("✅ First user found:\n");
    console.log("   Columns in public.users table:");
    Object.keys(firstUser).forEach((col) => {
      const val = firstUser[col];
      const display = typeof val === 'string' ? val.substring(0, 40) : JSON.stringify(val).substring(0, 40);
      console.log(`   - ${col}: ${typeof val} = ${display}`);
    });
    console.log();

    // 2. Try finding by auth.users email
    console.log("2️⃣ Finding Missira via auth.users API...\n");
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.log(`❌ Error listing auth users: ${authError.message}\n`);
      return;
    }

    const missiraAuthUser = authUsers.users.find(u => u.email === "misirakeita@gmail.com");
    if (!missiraAuthUser) {
      console.log("❌ Missira (misirakeita@gmail.com) NOT FOUND in auth.users\n");
      return;
    }

    console.log(`✅ Missira found in auth.users:\n`);
    console.log(`   ID: ${missiraAuthUser.id}`);
    console.log(`   Email: ${missiraAuthUser.email}`);
    console.log(`   Email verified: ${!!missiraAuthUser.email_confirmed_at}`);
    console.log(`   Created: ${missiraAuthUser.created_at}\n`);

    // 3. Check public.users table with this ID
    console.log("3️⃣ Checking public.users for this ID...\n");
    const { data: publicUsers, error: publicError } = await supabase
      .from("users")
      .select("*")
      .eq("id", missiraAuthUser.id);

    if (publicError) {
      console.log(`❌ Error: ${publicError.message}\n`);
      return;
    }

    if (!publicUsers || publicUsers.length === 0) {
      console.log("❌ NO RECORD in public.users table\n");
      console.log("   ⚠️  THIS IS THE PROBLEM:");
      console.log("   Auth user exists but no public.users profile!\n");
      return;
    }

    const publicUser = publicUsers[0];
    console.log("✅ Public user profile found:\n");
    console.log(`   ID: ${publicUser.id}`);
    console.log(`   Name: ${publicUser.name}`);
    console.log(`   Role: ${publicUser.role}`);
    console.log(`   Country: ${publicUser.country}`);
    console.log(`   Telephone: ${publicUser.telephone}`);
    console.log();

    // 4. Check artists table
    console.log("4️⃣ Checking artists table...\n");
    const { data: artists, error: artistsError } = await supabase
      .from("artists")
      .select("*")
      .eq("user_id", missiraAuthUser.id);

    if (artistsError) {
      console.log(`❌ Error: ${artistsError.message}\n`);
      return;
    }

    if (!artists || artists.length === 0) {
      console.log("❌ NO ARTIST RECORDS for this user\n");
      console.log("   This means the artist profile link is missing!\n");
      return;
    }

    console.log(`✅ Found ${artists.length} artist record(s):\n`);
    artists.forEach((a, i) => {
      console.log(`   ${i + 1}. Artist ID: ${a.id}`);
      console.log(`      Name: ${a.name}`);
      console.log(`      User ID: ${a.user_id}`);
    });
    console.log();

    // 5. Check artworks
    console.log("5️⃣ Checking artworks for artist...\n");
    const artistId = artists[0].id;
    const { data: artworks, error: artworksError } = await supabase
      .from("artworks")
      .select("id, title, status, artist_id, user_id, created_at")
      .eq("artist_id", artistId);

    if (artworksError) {
      console.log(`❌ Error: ${artworksError.message}\n`);
      return;
    }

    if (!artworks || artworks.length === 0) {
      console.log("❌ NO ARTWORKS for this artist\n");
      console.log("   Checking if artworks exist with user_id instead...\n");

      const { data: artworksByUser, error: artworksUserError } = await supabase
        .from("artworks")
        .select("id, title, status, artist_id, user_id, created_at")
        .eq("user_id", missiraAuthUser.id);

      if (artworksUserError) {
        console.log(`   Error: ${artworksUserError.message}\n`);
        return;
      }

      if (!artworksByUser || artworksByUser.length === 0) {
        console.log("   Also NO ARTWORKS by user_id\n");
        return;
      }

      console.log(`   ⚠️  Found ${artworksByUser.length} artwork(s) with WRONG artist_id:\n`);
      artworksByUser.forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}" [${a.status}]`);
        console.log(`      Artist ID: ${a.artist_id} (should be ${artistId})`);
        console.log(`      User ID: ${a.user_id}`);
      });
      return;
    }

    console.log(`✅ Found ${artworks.length} artwork(s):\n`);
    artworks.forEach((a, i) => {
      console.log(`   ${i + 1}. "${a.title}" [${a.status}]`);
      console.log(`      Created: ${new Date(a.created_at).toLocaleDateString('fr-FR')}`);
    });
    console.log();

    console.log("=".repeat(80) + "\n");
    console.log("✅ MISSIRA STATUS:\n");
    console.log(`   Auth user: ✅ EXISTS`);
    console.log(`   Public profile: ✅ EXISTS`);
    console.log(`   Artist record: ✅ EXISTS`);
    console.log(`   Artworks: ✅ ${artworks.length} artwork(s)`);
    console.log("\n   Dashboard should show her artworks now!\n");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

diagnose();
