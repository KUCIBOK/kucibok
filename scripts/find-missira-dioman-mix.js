#!/usr/bin/env node

/**
 * CRITICAL: Find artworks of Missira that are attributed to Dioman
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wyrmpddlhldjzoiwbshj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cm1wZGRsaGxkanpvaXdic2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwNjA0NywiZXhwIjoyMDg4MjgyMDQ3fQ.QQ6Bt-Tk5Vm_Lp8zD1SewXFgPRHGZgvA2v6zj87ijqs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MISSIRA_USER_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function findMisattributed() {
  console.log("🔍 SEARCHING FOR MISSIRA ARTWORKS ATTRIBUTED TO OTHERS\n");
  console.log("=".repeat(70) + "\n");

  try {
    // Get all artists to map IDs
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name, user_id");

    const artistMap = {};
    artists?.forEach((a) => {
      artistMap[a.id] = a.name;
    });

    console.log("🔎 Searching...\n");

    // Find artworks by Missira but with wrong artist_id
    const { data: missiraArtworksByUser } = await supabase
      .from("artworks")
      .select("id, title, artist_id, user_id")
      .eq("user_id", MISSIRA_USER_ID);

    const misattributed = missiraArtworksByUser?.filter(
      (a) => a.artist_id !== MISSIRA_ARTIST_ID
    ) || [];

    if (misattributed.length === 0) {
      console.log("✅ No misattributed Missira artworks found!\n");
      return;
    }

    console.log(`❌ FOUND ${misattributed.length} MISATTRIBUTED ARTWORK(S):\n`);

    misattributed.forEach((aw) => {
      const wrongArtist = artistMap[aw.artist_id] || "UNKNOWN";
      console.log(`   "${aw.title}"`);
      console.log(`      ID: ${aw.id}`);
      console.log(`      Attributed to: ${wrongArtist}`);
      console.log(`      Should be: Missira Keita`);
      console.log(`      Fix SQL: `);
      console.log(
        `      UPDATE artworks SET artist_id = '${MISSIRA_ARTIST_ID}' WHERE id = '${aw.id}';`
      );
      console.log("");
    });

    // Also check for Dioman misattribution specifically
    const { data: dioman } = await supabase
      .from("artists")
      .select("id")
      .ilike("name", "%dioman%")
      .single();

    if (dioman) {
      console.log(`\n🔎 Checking Dioman (ID: ${dioman.id})...\n`);

      const { data: diomanMissira } = await supabase
        .from("artworks")
        .select("id, title, user_id")
        .eq("artist_id", dioman.id)
        .eq("user_id", MISSIRA_USER_ID);

      if (diomanMissira && diomanMissira.length > 0) {
        console.log(`⚠️  CRITICAL: ${diomanMissira.length} Missira artworks belong to Dioman!\n`);
        diomanMissira.forEach((aw) => {
          console.log(`   "${aw.title}" (ID: ${aw.id})`);
        });
      } else {
        console.log("✅ No Missira artworks attributed to Dioman\n");
      }
    }
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

findMisattributed();
