#!/usr/bin/env node

/**
 * Find which artists see mixed/wrong artworks
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

async function findMixedCatalog() {
  console.log(`🔍 Finding artists with mixed/shared artworks\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Get all artworks with their relationships
    const { data: allArtworks } = await supabaseAdmin
      .from("artworks")
      .select("id, artist_id, user_id");

    // Group artworks by artist_id
    const byArtistId = {};
    allArtworks?.forEach((a) => {
      if (!byArtistId[a.artist_id]) {
        byArtistId[a.artist_id] = [];
      }
      byArtistId[a.artist_id].push(a);
    });

    // Get all artists
    const { data: artists } = await supabaseAdmin
      .from("artists")
      .select("id, name, user_id");

    const artistsMap = {};
    artists?.forEach((a) => {
      artistsMap[a.id] = a;
    });

    console.log("🎨 Artists and their artworks:\n");

    const mixed = [];

    Object.entries(byArtistId).forEach(([artistId, artworks]) => {
      const artist = artistsMap[artistId];
      const artistName = artist?.name || "Unknown";

      const uniqueUserIds = [...new Set(artworks.map(a => a.user_id).filter(Boolean))];

      console.log(`\n📌 Artist: ${artistName}`);
      console.log(`   artist_id: ${artistId}`);
      console.log(`   artworks: ${artworks.length}`);
      console.log(`   unique users who created them: ${uniqueUserIds.length}`);

      if (uniqueUserIds.length > 1) {
        console.log(`   ⚠️  MIXED! Artworks created by ${uniqueUserIds.length} different users!`);
        mixed.push({
          artistName,
          artistId,
          artworkCount: artworks.length,
          userCount: uniqueUserIds.length,
          userIds: uniqueUserIds,
        });
      } else if (uniqueUserIds.length === 1 && artist?.user_id !== uniqueUserIds[0]) {
        console.log(`   ⚠️  MISMATCH! Artist.user_id doesn't match the creator user_id`);
        console.log(`      Artist.user_id: ${artist?.user_id}`);
        console.log(`      Creator user_id: ${uniqueUserIds[0]}`);
        mixed.push({
          artistName,
          artistId,
          artworkCount: artworks.length,
          userCount: 1,
          mismatch: true,
        });
      } else {
        console.log(`   ✅ Clean`);
      }
    });

    console.log("\n" + "=".repeat(70) + "\n");
    console.log(`📊 Summary: ${mixed.length} artists have mixed/shared artworks\n`);

    if (mixed.length > 0) {
      console.log("Artists with issues:");
      mixed.forEach((m) => {
        if (m.mismatch) {
          console.log(`   ❌ ${m.artistName} — user_id mismatch`);
        } else {
          console.log(`   ❌ ${m.artistName} — ${m.artworkCount} artworks from ${m.userCount} users`);
        }
      });
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

findMixedCatalog();
