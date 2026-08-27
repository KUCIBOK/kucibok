#!/usr/bin/env node

/**
 * MIGRATION: Fix artist_id for all artworks
 *
 * Problem: artworks.artist_id was set to user_id instead of artists.id
 * Solution: For each artwork, find the corresponding artist record and update artist_id
 *
 * Usage: node scripts/migrate-fix-artist-ids.js
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

async function migrateArtistIds() {
  console.log(`🔧 Migration: Fix artist_id references for all artworks\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Get all artworks
    console.log("📖 1. Fetching all artworks...");
    const { data: allArtworks, error: fetchError } = await supabaseAdmin
      .from("artworks")
      .select("id, user_id, artist_id");

    if (fetchError) {
      console.error("❌ Error fetching artworks:", fetchError.message);
      return;
    }

    console.log(`   Found ${allArtworks?.length || 0} artworks\n`);

    // Get all artists
    console.log("🎨 2. Fetching all artists...");
    const { data: allArtists } = await supabaseAdmin
      .from("artists")
      .select("id, user_id");

    console.log(`   Found ${allArtists?.length || 0} artists\n`);

    // Create a map of user_id -> artist_id
    const userToArtist = {};
    allArtists?.forEach((artist) => {
      userToArtist[artist.user_id] = artist.id;
    });

    // Separate artworks by their current state
    const needsUpdate = [];
    const orphaned = [];
    const alreadyGood = [];

    allArtworks?.forEach((artwork) => {
      if (!artwork.user_id) {
        orphaned.push(artwork);
      } else if (artwork.artist_id === artwork.user_id) {
        // BROKEN: artist_id == user_id (the bug!)
        needsUpdate.push(artwork);
      } else if (userToArtist[artwork.user_id]) {
        // Check if artist_id actually references an artist
        const expectedArtistId = userToArtist[artwork.user_id];
        if (artwork.artist_id !== expectedArtistId) {
          needsUpdate.push(artwork);
        } else {
          alreadyGood.push(artwork);
        }
      } else {
        // No artist found for this user_id
        needsUpdate.push(artwork);
      }
    });

    console.log("📊 3. Status breakdown:\n");
    console.log(`   ✅ Already correct: ${alreadyGood.length}`);
    console.log(`   ⚠️  Need update: ${needsUpdate.length}`);
    console.log(`   ❌ Orphaned (no user_id): ${orphaned.length}`);
    console.log("\n");

    if (needsUpdate.length === 0) {
      console.log("✅ All artworks are already correct! No migration needed.\n");
      return;
    }

    // Perform the migration
    console.log("🔄 4. Migrating artworks...\n");

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const artwork of needsUpdate) {
      const newArtistId = userToArtist[artwork.user_id];

      if (!newArtistId) {
        // No artist for this user — create one
        const { data: newArtist, error: createError } = await supabaseAdmin
          .from("artists")
          .insert([{ user_id: artwork.user_id }])
          .select();

        if (createError) {
          console.log(
            `   ❌ Failed to create artist for user ${artwork.user_id.substring(0, 8)}...`
          );
          failed++;
          continue;
        }

        if (newArtist && newArtist[0]) {
          userToArtist[artwork.user_id] = newArtist[0].id;
          const { error: updateError } = await supabaseAdmin
            .from("artworks")
            .update({ artist_id: newArtist[0].id })
            .eq("id", artwork.id);

          if (updateError) {
            console.log(`   ❌ Failed to update artwork ${artwork.id.substring(0, 8)}...`);
            failed++;
          } else {
            console.log(
              `   ✅ Updated artwork "${artwork.id.substring(0, 8)}..." (created new artist)`
            );
            updated++;
          }
        }
      } else {
        // Update the artwork with correct artist_id
        const { error: updateError } = await supabaseAdmin
          .from("artworks")
          .update({ artist_id: newArtistId })
          .eq("id", artwork.id);

        if (updateError) {
          console.log(`   ❌ Failed to update artwork ${artwork.id.substring(0, 8)}...`);
          console.log(`      Error: ${updateError.message}`);
          failed++;
        } else {
          updated++;
          // Show progress every 10 updates
          if (updated % 10 === 0) {
            console.log(`   ✅ Updated ${updated}/${needsUpdate.length} artworks...`);
          }
        }
      }
    }

    console.log("\n");
    console.log("=".repeat(70) + "\n");
    console.log("📈 Migration Results:\n");
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ℹ️  Orphaned (can't fix): ${orphaned.length}`);
    console.log("\n");

    if (failed === 0 && orphaned.length === 0) {
      console.log("✨ Migration complete! All artworks are now correctly linked to their artists.");
    } else if (failed > 0) {
      console.log("⚠️  Some artworks failed to update. Check the API and database.");
    }

    if (orphaned.length > 0) {
      console.log(
        `\n💭 Note: ${orphaned.length} artworks have no user_id and cannot be fixed automatically.`
      );
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

migrateArtistIds();
