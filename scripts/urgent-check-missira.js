#!/usr/bin/env node

/**
 * URGENT: Quick check why Missira can't see her artworks
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MISSIRA_USER_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function checkMissira() {
  console.log("🚨 URGENT CHECK: WHY MISSIRA CAN'T SEE HER ARTWORKS\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. User record
    console.log("1️⃣ User record in users table:\n");
    const { data: user } = await supabase
      .from("users")
      .select("id, email, role, name")
      .eq("id", MISSIRA_USER_ID)
      .single();

    if (!user) {
      console.log("❌ CRITICAL: User not found!");
      console.log(`   User ID: ${MISSIRA_USER_ID}\n`);
      return;
    }

    console.log(`✅ User found:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Name: ${user.name}\n`);

    // 2. Artist record
    console.log("2️⃣ Artist record in artists table:\n");
    const { data: artist } = await supabase
      .from("artists")
      .select("id, user_id, name")
      .eq("user_id", MISSIRA_USER_ID)
      .single();

    if (!artist) {
      console.log("❌ CRITICAL PROBLEM #1: NO ARTIST RECORD!");
      console.log(`   Missira's user_id: ${MISSIRA_USER_ID}`);
      console.log(`   Expected artist_id: ${MISSIRA_ARTIST_ID}\n`);
      console.log("   👉 FIX: Run: node scripts/fix-missira-profile.js\n");
    } else {
      console.log(`✅ Artist record found:`);
      console.log(`   Artist ID: ${artist.id}`);
      console.log(`   User ID: ${artist.user_id}`);
      console.log(`   Name: ${artist.name}\n`);

      if (artist.id !== MISSIRA_ARTIST_ID) {
        console.log(
          `⚠️  WARNING: artist.id doesn't match expected MISSIRA_ARTIST_ID`
        );
        console.log(`   Current: ${artist.id}`);
        console.log(`   Expected: ${MISSIRA_ARTIST_ID}\n`);
      }
    }

    // 3. Artworks count
    console.log("3️⃣ Artworks in database:\n");

    const { data: byArtistId, error: e1 } = await supabase
      .from("artworks")
      .select("id, title, status")
      .eq("artist_id", MISSIRA_ARTIST_ID);

    const { data: byUserId, error: e2 } = await supabase
      .from("artworks")
      .select("id, title, status, artist_id")
      .eq("user_id", MISSIRA_USER_ID);

    const total = (byArtistId?.length || 0) + (byUserId?.length || 0);

    if (total === 0) {
      console.log("❌ CRITICAL PROBLEM #2: NO ARTWORKS FOUND!");
      console.log(`   Searched by artist_id: ${MISSIRA_ARTIST_ID} → ${byArtistId?.length || 0}`);
      console.log(`   Searched by user_id: ${MISSIRA_USER_ID} → ${byUserId?.length || 0}\n`);
      console.log("   👉 Either Missira never uploaded artworks, or they were deleted.\n");
    } else {
      console.log(`✅ Found ${total} artwork(s):\n`);

      if (byArtistId && byArtistId.length > 0) {
        console.log(`   By artist_id (${byArtistId.length}):`);
        byArtistId.forEach((a) => {
          console.log(`      - "${a.title}" [${a.status}]`);
        });
      }

      if (byUserId && byUserId.length > 0) {
        console.log(`\n   By user_id (${byUserId.length}):`);
        byUserId.forEach((a) => {
          console.log(
            `      - "${a.title}" [${a.status}] (artist_id: ${a.artist_id})`
          );
        });

        const wrongArtist = byUserId.filter((a) => a.artist_id !== MISSIRA_ARTIST_ID);
        if (wrongArtist.length > 0) {
          console.log(`\n   ⚠️  ${wrongArtist.length} artwork(s) have WRONG artist_id!`);
          console.log(`       They need to be reassigned.\n`);
        }
      }
    }

    // 4. What the API returns now (simulating the dashboard call)
    console.log("4️⃣ Simulating dashboard API call:\n");
    console.log(`   Query: GET /api/artworks?artist_id=${MISSIRA_ARTIST_ID}\n`);

    const { data: apiResult } = await supabase
      .from("artworks")
      .select("id, title, status")
      .eq("artist_id", MISSIRA_ARTIST_ID)
      .order("created_at", { ascending: false });

    console.log(
      `   Result: ${apiResult?.length || 0} artwork(s) (should be ${byArtistId?.length || 0})`
    );

    if (apiResult && apiResult.length > 0) {
      console.log(`   ✅ Dashboard WILL show these artworks:\n`);
      apiResult.forEach((a) => {
        console.log(`      - "${a.title}" [${a.status}]`);
      });
    } else {
      console.log(`   ❌ Dashboard will show NOTHING (empty)\n`);
    }

    // Summary
    console.log("\n" + "=".repeat(80) + "\n");
    console.log("📋 SUMMARY:\n");

    if (!artist) {
      console.log("❌ BLOCKER #1: Missira has NO artist record");
      console.log("   Fix: node scripts/fix-missira-profile.js\n");
    }

    if (total === 0) {
      console.log("❌ BLOCKER #2: Missira has NO artworks in database");
      console.log("   Action: Check if artworks were ever uploaded or if they were deleted\n");
    } else if (apiResult && apiResult.length === 0) {
      console.log("❌ BLOCKER #3: Artworks exist but API doesn't return them");
      console.log("   This shouldn't happen after our fix. Check:");
      console.log("   - Vercel deployment (may not have redeployed)");
      console.log("   - Browser cache (try Ctrl+F5)\n");
    } else {
      console.log("✅ Everything looks good!");
      console.log("   Missira should see her artworks now.");
      console.log("   If she still doesn't:");
      console.log("   - Hard refresh browser (Ctrl+F5)");
      console.log("   - Logout and login again\n");
    }
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

checkMissira();
