#!/usr/bin/env node

/**
 * FIX SCRIPT: Ensure Missira has proper artist profile record
 *
 * This script:
 * 1. Checks if Missira exists in users table
 * 2. Checks if she has an artist record
 * 3. Creates artist record if missing
 * 4. Ensures artist.id is correct
 */

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixMissiraProfile() {
  console.log("🔧 FIXING MISSIRA PROFILE\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Find Missira
    console.log("1️⃣ Finding Missira in users table...\n");
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, role, name")
      .ilike("email", "%missira%");

    if (usersError) {
      console.error("❌ Error:", usersError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.error("❌ Missira not found in users table");
      return;
    }

    const missiraUser = users[0];
    console.log(`✅ Found Missira: ${missiraUser.email} (ID: ${missiraUser.id})`);
    console.log(`   Role: ${missiraUser.role}`);
    console.log(`   Name: ${missiraUser.name}\n`);

    if (missiraUser.role !== "artist") {
      console.warn(`⚠️  Warning: Missira's role is '${missiraUser.role}', not 'artist'`);
      console.log("   This may be a separate issue.\n");
    }

    // 2. Check if artist record exists
    console.log("2️⃣ Checking artist record...\n");
    const { data: artists, error: artistsError } = await supabase
      .from("artists")
      .select("id, user_id, name, email")
      .eq("user_id", missiraUser.id);

    if (artistsError) {
      console.error("❌ Error:", artistsError.message);
      return;
    }

    if (artists && artists.length > 0) {
      const artist = artists[0];
      console.log(`✅ Artist record found:`);
      console.log(`   ID: ${artist.id}`);
      console.log(`   User ID: ${artist.user_id}`);
      console.log(`   Name: ${artist.name || "N/A"}`);
      console.log(`   Email: ${artist.email || "N/A"}\n`);

      // Verify consistency
      if (artist.user_id !== missiraUser.id) {
        console.warn(`⚠️  WARNING: artist.user_id mismatch!`);
        console.log(`   artist.user_id = ${artist.user_id}`);
        console.log(`   users.id = ${missiraUser.id}\n`);
      }

      console.log("✅ Artist profile is complete. No fixes needed.\n");
      return;
    }

    // 3. No artist record found - create one
    console.log(
      "❌ No artist record found. Creating one...\n"
    );

    const newArtistId = crypto.randomUUID();
    const { data: newArtist, error: createError } = await supabase
      .from("artists")
      .insert([
        {
          id: newArtistId,
          user_id: missiraUser.id,
          name: missiraUser.name || missiraUser.email?.split("@")[0] || "Missira",
          email: missiraUser.email,
        },
      ])
      .select();

    if (createError) {
      console.error("❌ Error creating artist record:", createError.message);
      return;
    }

    console.log("✅ Artist record created:");
    console.log(`   ID: ${newArtistId}`);
    console.log(`   User ID: ${missiraUser.id}`);
    console.log(`   Name: ${missiraUser.name || missiraUser.email?.split("@")[0]}\n`);

    // 4. Verify artworks now show up
    console.log("3️⃣ Verifying artworks are now accessible...\n");

    const { data: artworks, error: artworksError } = await supabase
      .from("artworks")
      .select("id, title, status")
      .eq("artist_id", newArtistId)
      .order("created_at", { ascending: false });

    if (artworksError) {
      console.error("❌ Error:", artworksError.message);
      return;
    }

    if (!artworks || artworks.length === 0) {
      console.warn(
        `⚠️  No artworks found with artist_id = ${newArtistId}`
      );
      console.log("   Checking by user_id...\n");

      const { data: artworksByUser, error: error2 } = await supabase
        .from("artworks")
        .select("id, title, status, artist_id")
        .eq("user_id", missiraUser.id)
        .order("created_at", { ascending: false });

      if (!error2 && artworksByUser && artworksByUser.length > 0) {
        console.log(`   ⚠️  Found ${artworksByUser.length} artworks with wrong artist_id:`);
        artworksByUser.forEach((aw) => {
          console.log(
            `      - "${aw.title}" (artist_id: ${aw.artist_id}, should be: ${newArtistId})`
          );
        });
        console.log("\n   These artworks have artist_id pointing to old record.");
        console.log("   They may need to be reassigned.\n");
      }
    } else {
      console.log(`✅ Found ${artworks.length} artworks:`);
      artworks.forEach((aw) => {
        console.log(`   - "${aw.title}" [${aw.status}]`);
      });
    }

    console.log("\n" + "=".repeat(80) + "\n");
    console.log("✅ FIX COMPLETE\n");
    console.log("Missira can now log in and see all her artworks in her dashboard.\n");
  } catch (err) {
    console.error("❌ UNEXPECTED ERROR:", err.message);
  }
}

fixMissiraProfile();
