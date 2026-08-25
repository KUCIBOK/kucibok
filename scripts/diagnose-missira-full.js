#!/usr/bin/env node

/**
 * FULL DIAGNOSTIC: Vérifier l'état complet de Missira dans la base de données
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fullDiagnostic() {
  console.log("🔍 FULL DIAGNOSTIC: MISSIRA KEITA\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Find Missira in users table
    console.log("📋 STEP 1: Finding Missira in users table...\n");
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, role, name")
      .ilike("email", "%missira%");

    if (usersError) {
      console.error("❌ Error:", usersError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log("❌ MISSIRA NOT FOUND in users table!");
      return;
    }

    const missiraUser = users[0];
    console.log(`✅ Found Missira:`);
    console.log(`   ID: ${missiraUser.id}`);
    console.log(`   Email: ${missiraUser.email}`);
    console.log(`   Role: ${missiraUser.role}`);
    console.log(`   Name: ${missiraUser.name}\n`);

    // 2. Check artists table
    console.log("📋 STEP 2: Finding Missira in artists table...\n");
    const { data: artists, error: artistsError } = await supabase
      .from("artists")
      .select("id, user_id, name, email")
      .eq("user_id", missiraUser.id);

    if (artistsError) {
      console.error("❌ Error:", artistsError.message);
      return;
    }

    if (!artists || artists.length === 0) {
      console.log("❌ MISSIRA NOT FOUND in artists table!");
      console.log("   This is the CRITICAL ISSUE. Missira needs an artist record.\n");
    } else {
      const artist = artists[0];
      console.log(`✅ Found artist record:`);
      console.log(`   ID: ${artist.id}`);
      console.log(`   User ID: ${artist.user_id}`);
      console.log(`   Name: ${artist.name}`);
      console.log(`   Email: ${artist.email}\n`);
    }

    // 3. Check artworks
    const artistId = artists?.[0]?.id || missiraUser.id;
    console.log(`📋 STEP 3: Finding artworks by artist_id = ${artistId}...\n`);

    const { data: artworksByArtist, error: artworksError } = await supabase
      .from("artworks")
      .select("id, title, status, for_sale, created_at")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });

    if (artworksError) {
      console.error("❌ Error:", artworksError.message);
      return;
    }

    if (!artworksByArtist || artworksByArtist.length === 0) {
      console.log("❌ NO ARTWORKS FOUND by artist_id");
    } else {
      console.log(`✅ Found ${artworksByArtist.length} artwork(s) by artist_id:\n`);
      artworksByArtist.forEach((aw, idx) => {
        console.log(`   ${idx + 1}. "${aw.title}"`);
        console.log(`      Status: ${aw.status}, For Sale: ${aw.for_sale}`);
      });
      console.log();
    }

    // 4. Check artworks by user_id
    console.log(`📋 STEP 4: Finding artworks by user_id = ${missiraUser.id}...\n`);

    const { data: artworksByUser, error: artworksError2 } = await supabase
      .from("artworks")
      .select("id, title, status, for_sale, artist_id, created_at")
      .eq("user_id", missiraUser.id)
      .order("created_at", { ascending: false });

    if (artworksError2) {
      console.error("❌ Error:", artworksError2.message);
      return;
    }

    if (!artworksByUser || artworksByUser.length === 0) {
      console.log("❌ NO ARTWORKS FOUND by user_id");
    } else {
      console.log(`✅ Found ${artworksByUser.length} artwork(s) by user_id:\n`);
      artworksByUser.forEach((aw, idx) => {
        console.log(`   ${idx + 1}. "${aw.title}"`);
        console.log(`      Status: ${aw.status}`);
        console.log(`      Artist ID: ${aw.artist_id}`);
      });
      console.log();
    }

    // 5. Summary
    console.log("=".repeat(80) + "\n");
    console.log("📊 SUMMARY:\n");

    if (!artists || artists.length === 0) {
      console.log("❌ CRITICAL: Missira has NO artist record!");
      console.log("   Create artist record with: user_id = " + missiraUser.id);
      console.log();
    }

    const hasArtworks = (artworksByArtist?.length || 0) + (artworksByUser?.length || 0) > 0;
    if (!hasArtworks) {
      console.log("❌ CRITICAL: Missira has NO artworks!");
    } else {
      console.log(`✅ Missira has artworks.`);
      const byStatus = {};
      [...(artworksByArtist || []), ...(artworksByUser || [])].forEach((aw) => {
        byStatus[aw.status] = (byStatus[aw.status] || 0) + 1;
      });
      Object.keys(byStatus).forEach((status) => {
        console.log(`   ${status}: ${byStatus[status]}`);
      });
    }

    console.log("\n💡 EXPECTED BEHAVIOR:\n");
    console.log("   When Missira logs in:");
    console.log(
      `   1. Dashboard loads artist profile from /api/profile/${missiraUser.id}`
    );
    console.log(
      `   2. Gets artistProfile.id = ${artists?.[0]?.id || "[MISSING]"}`
    );
    console.log(
      `   3. Calls getMyArtworks() with artist_id = ${artists?.[0]?.id || "[MISSING]"}`
    );
    console.log("   4. API should return ALL artworks (after our fix)");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

fullDiagnostic();
