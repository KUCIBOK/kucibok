#!/usr/bin/env node

/**
 * Diagnostic: Identify why artworks are mixed between artists
 * Check if artist_id references are correct
 */

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.production.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      const value = valueParts.join("=").replace(/^"/, "").replace(/"$/, "");
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function diagnoseArtistIssue() {
  console.log(`🔍 Diagnosing Artist-Artwork Linking Issue\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // 1. Check artists table
    console.log("📋 1. Artists in database:\n");
    const { data: artists } = await supabaseAdmin
      .from("artists")
      .select("id, user_id, name")
      .limit(10);

    if (artists && artists.length > 0) {
      console.log(`   Found ${artists.length} artists:`);
      artists.forEach((a) => {
        console.log(`   • ${a.name} (id: ${a.id.substring(0, 8)}..., user_id: ${a.user_id?.substring(0, 8) || "NULL"}...)`);
      });
    } else {
      console.log("   ❌ No artists found!");
    }

    console.log("\n");

    // 2. Check a sample of artworks and their artist_id references
    console.log("📋 2. Artworks and their artist references:\n");
    const { data: artworks } = await supabaseAdmin
      .from("artworks")
      .select("id, title, user_id, artist_id")
      .limit(15);

    if (artworks && artworks.length > 0) {
      console.log(`   Sampling ${Math.min(15, artworks.length)} artworks:`);
      artworks.forEach((a) => {
        const artistMatch = artists?.find((art) => art.id === a.artist_id);
        const userMatch = artists?.find((art) => art.user_id === a.artist_id);

        console.log(`   • "${a.title.substring(0, 20)}..."`);
        console.log(`     - user_id: ${a.user_id?.substring(0, 8)}...`);
        console.log(`     - artist_id: ${a.artist_id?.substring(0, 8)}...`);

        if (artistMatch) {
          console.log(`     ✅ Matches artist: ${artistMatch.name}`);
        } else if (userMatch) {
          console.log(`     ⚠️  artist_id looks like a user_id, not an artist_id!`);
          console.log(`        (found user_id that matches: ${userMatch.name})`);
        } else {
          console.log(`     ❌ artist_id doesn't reference any artist!`);
        }
      });
    }

    console.log("\n");

    // 3. Check for orphaned artworks
    console.log("📋 3. Artworks with broken artist_id references:\n");
    const { data: orphaned } = await supabaseAdmin
      .from("artworks")
      .select("id, title, artist_id")
      .isNull("artist_id")
      .limit(5);

    if (orphaned && orphaned.length > 0) {
      console.log(`   Found ${orphaned.length} artworks with NULL artist_id`);
    } else {
      console.log(`   ✅ No NULL artist_ids`);
    }

    console.log("\n");

    // 4. Check if user_id was used as artist_id (the bug)
    console.log("📋 4. Checking if artworks were created with user_id as artist_id:\n");
    const { data: potentiallyBroken } = await supabaseAdmin
      .from("artworks")
      .select("id, title, user_id, artist_id")
      .limit(100);

    let broken = 0;
    potentiallyBroken?.forEach((a) => {
      if (a.user_id === a.artist_id) {
        broken++;
      }
    });

    if (broken > 0) {
      console.log(`   ❌ FOUND BUG: ${broken}/100 sampled artworks have user_id === artist_id`);
      console.log(`      This means artist_id is NOT referencing the artists table!`);
    } else {
      console.log(`   ✅ user_id !== artist_id (good)`);
    }

    console.log("\n" + "=".repeat(70) + "\n");

    if (broken > 0) {
      console.log("🚨 DIAGNOSIS: The bug is confirmed!");
      console.log("   When artworks are created, artist_id is set to user_id");
      console.log("   But artist_id should reference the artists table, not users!\n");
      console.log("SOLUTION: Need to fix the artwork creation logic to:");
      console.log("   1. Find the artist record for the user");
      console.log("   2. Use that artist.id as the artwork artist_id");
      console.log("   3. Create an artist record if none exists");
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

diagnoseArtistIssue();
