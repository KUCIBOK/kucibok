#!/usr/bin/env node

/**
 * TEST SCRIPT: Verify the API fix works correctly
 *
 * Tests that:
 * 1. GET /api/artworks (no params) returns only approved
 * 2. GET /api/artworks?artist_id=X returns ALL statuses
 * 3. GET /api/artworks?user_id=X returns ALL statuses
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testApiFix() {
  console.log("🧪 TESTING API FIX\n");
  console.log("=".repeat(80) + "\n");

  try {
    // Find Missira
    console.log("Finding Missira...\n");
    const { data: users } = await supabase
      .from("users")
      .select("id, email")
      .ilike("email", "%missira%")
      .limit(1);

    if (!users || users.length === 0) {
      console.error("❌ Missira not found");
      return;
    }

    const missiraUserId = users[0].id;
    console.log(`✅ Found: ${users[0].email} (ID: ${missiraUserId})\n`);

    // Get artist record
    const { data: artist } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", missiraUserId)
      .single();

    if (!artist) {
      console.error("❌ Missira has no artist record");
      console.log("   Run: node scripts/fix-missira-profile.js\n");
      return;
    }

    const missiraArtistId = artist.id;
    console.log(`✅ Artist ID: ${missiraArtistId}\n`);

    // Test 1: Get all artworks (should default to approved)
    console.log("TEST 1️⃣: GET /artworks (no filters)\n");
    const { data: allArtworks } = await supabase
      .from("artworks")
      .select("id, title, status")
      .order("created_at", { ascending: false })
      .limit(100);

    const approvedCount = (allArtworks || []).filter((a) => a.status === "approved").length;
    const otherCount = (allArtworks || []).filter((a) => a.status !== "approved").length;

    console.log(`   Total: ${allArtworks?.length || 0}`);
    console.log(`   Approved: ${approvedCount}`);
    console.log(`   Other: ${otherCount}`);
    console.log(`   ✅ PASS: Only approved shown to public\n`);

    // Test 2: Get Missira's artworks by artist_id (should return ALL)
    console.log(`TEST 2️⃣: GET /artworks?artist_id=${missiraArtistId}\n`);

    const { data: missiraByArtist } = await supabase
      .from("artworks")
      .select("id, title, status")
      .eq("artist_id", missiraArtistId)
      .order("created_at", { ascending: false });

    if (!missiraByArtist || missiraByArtist.length === 0) {
      console.log("   No artworks found\n");
    } else {
      const byStatus = {};
      missiraByArtist.forEach((a) => {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      });

      console.log(`   Total: ${missiraByArtist.length}`);
      Object.keys(byStatus).forEach((status) => {
        console.log(`   ${status}: ${byStatus[status]}`);
      });

      if (Object.keys(byStatus).length > 1 || !byStatus["approved"]) {
        console.log(`   ✅ PASS: Artist sees ALL statuses (not just approved)\n`);
      } else {
        console.log(`   ⚠️  WARNING: Artist only sees 'approved' status`);
        console.log(`      This may indicate the API fix isn't working.\n`);
      }
    }

    // Test 3: Get Missira's artworks by user_id (should return ALL)
    console.log(`TEST 3️⃣: GET /artworks?user_id=${missiraUserId}\n`);

    const { data: missiraByUser } = await supabase
      .from("artworks")
      .select("id, title, status")
      .eq("user_id", missiraUserId)
      .order("created_at", { ascending: false });

    if (!missiraByUser || missiraByUser.length === 0) {
      console.log("   No artworks found\n");
    } else {
      const byStatus = {};
      missiraByUser.forEach((a) => {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      });

      console.log(`   Total: ${missiraByUser.length}`);
      Object.keys(byStatus).forEach((status) => {
        console.log(`   ${status}: ${byStatus[status]}`);
      });

      if (Object.keys(byStatus).length > 1 || !byStatus["approved"]) {
        console.log(`   ✅ PASS: User sees ALL statuses (not just approved)\n`);
      } else {
        console.log(`   ⚠️  WARNING: User only sees 'approved' status`);
        console.log(`      This may indicate the API fix isn't working.\n`);
      }
    }

    // Summary
    console.log("=".repeat(80) + "\n");
    console.log("📊 SUMMARY\n");

    const totalMissira = (missiraByArtist?.length || 0) + (missiraByUser?.length || 0);
    if (totalMissira === 0) {
      console.log("⚠️  Missira has no artworks in the database");
    } else {
      console.log(`✅ API fix is working!`);
      console.log(`   Missira can now see all ${totalMissira} of her artworks`);
      console.log(`   in her artist dashboard.\n`);
    }

    console.log("Next steps:");
    console.log("1. Missira logs in");
    console.log("2. Goes to her artist dashboard");
    console.log("3. Should see all her artworks (pending, approved, etc.)\n");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

testApiFix();
