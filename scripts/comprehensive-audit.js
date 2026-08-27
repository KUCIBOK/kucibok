#!/usr/bin/env node

/**
 * COMPREHENSIVE AUDIT: Check ALL artists for data integrity issues
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wyrmpddlhldjzoiwbshj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cm1wZGRsaGxkanpvaXdic2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwNjA0NywiZXhwIjoyMDg4MjgyMDQ3fQ.QQ6Bt-Tk5Vm_Lp8zD1SewXFgPRHGZgvA2v6zj87ijqs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function comprehensiveAudit() {
  console.log("🔍 COMPREHENSIVE AUDIT — ALL ARTISTS\n");
  console.log("=".repeat(70) + "\n");

  try {
    // Get all artists
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name, user_id")
      .order("name");

    if (!artists) {
      console.log("❌ Failed to fetch artists");
      return;
    }

    console.log(`Found ${artists.length} artists\n`);

    // Get all artworks
    const { data: allArtworks } = await supabase
      .from("artworks")
      .select("id, title, artist_id, user_id");

    const issues = [];

    // Check each artist
    for (const artist of artists) {
      const artistArtworks = allArtworks?.filter((a) => a.artist_id === artist.id) || [];

      if (artistArtworks.length === 0) continue;

      // Check for mismatched user_id
      const mismatched = artistArtworks.filter((a) => a.user_id !== artist.user_id);

      if (mismatched.length > 0) {
        issues.push({
          artist: artist.name,
          artistId: artist.id,
          issues: mismatched,
        });
      }

      // Check for untitled artworks
      const untitled = artistArtworks.filter((a) => !a.title || a.title.trim() === "");
      if (untitled.length > 0) {
        console.log(`⚠️  ${artist.name}: ${untitled.length} untitled artwork(s)`);
        untitled.forEach((aw) => {
          console.log(`     ID: ${aw.id} (user_id: ${aw.user_id})`);
        });
        console.log("");
      }
    }

    // Report issues
    if (issues.length === 0) {
      console.log("✅ NO ISSUES FOUND - All artwork-artist linkages are correct!\n");
    } else {
      console.log(`❌ FOUND ${issues.length} ARTIST(S) WITH ISSUES:\n`);

      issues.forEach((issue) => {
        console.log(`🚨 ${issue.artist}`);
        console.log(`   Artist ID: ${issue.artistId}`);
        console.log(`   Artist user_id: ${issue.issues[0]?.user_id || "?"}\n`);

        issue.issues.forEach((aw) => {
          console.log(`   ❌ "${aw.title || "(NO TITLE)"}" (ID: ${aw.id})`);
          console.log(`      artwork.user_id: ${aw.user_id} (MISMATCH!)`);
          console.log(`      Should have artist_id: ${issue.artistId}\n`);
        });
      });

      console.log("\n" + "=".repeat(70));
      console.log("\n📋 FIX SQL STATEMENTS:\n");

      issues.forEach((issue) => {
        issue.issues.forEach((aw) => {
          console.log(
            `UPDATE artworks SET artist_id = '${issue.artistId}' WHERE id = '${aw.id}';`
          );
        });
      });
    }
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

comprehensiveAudit();
