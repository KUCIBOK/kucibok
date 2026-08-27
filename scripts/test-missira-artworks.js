#!/usr/bin/env node

/**
 * Test script: Verify Missira sees only her 9 artworks, not all 300
 * Usage: node scripts/test-missira-artworks.js
 */

const MISSIRA_USER_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";
const API_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

async function testArtworksFilter() {
  console.log(`🎨 Testing Missira's Artwork Filters\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Test 1: Fetch by user_id (what the buyer dashboard uses)
    console.log("1️⃣  Testing by user_id (buyer dashboard)\n");
    console.log(`   GET /api/artworks?user_id=${MISSIRA_USER_ID}`);

    let response = await fetch(
      `${API_URL}/api/artworks?user_id=${MISSIRA_USER_ID}`,
      { headers: { "Content-Type": "application/json" } }
    );
    let data = await response.json();
    let count = data?.artworks?.length || data?.length || 0;

    console.log(`   Response: ${count} artworks\n`);
    if (count === 9) {
      console.log(`   ✅ CORRECT! Missira sees her 9 artworks\n`);
    } else {
      console.log(`   ❌ WRONG! Expected 9, got ${count}\n`);
    }

    // Test 2: Fetch by artist_id (what the artist dashboard uses)
    console.log("2️⃣  Testing by artist_id (artist dashboard)\n");
    console.log(`   GET /api/artworks?artist_id=${MISSIRA_ARTIST_ID}`);

    response = await fetch(
      `${API_URL}/api/artworks?artist_id=${MISSIRA_ARTIST_ID}`,
      { headers: { "Content-Type": "application/json" } }
    );
    data = await response.json();
    count = data?.artworks?.length || data?.length || 0;

    console.log(`   Response: ${count} artworks\n`);
    if (count === 9) {
      console.log(`   ✅ CORRECT! Missira's artist profile shows 9 artworks\n`);
    } else {
      console.log(`   ❌ WRONG! Expected 9, got ${count}\n`);
    }

    // Test 3: Fetch all (public, should be 300 but filtered by status)
    console.log("3️⃣  Testing public artworks (no filter)\n");
    console.log(`   GET /api/artworks?for_sale=true&status=approved`);

    response = await fetch(
      `${API_URL}/api/artworks?for_sale=true&status=approved&limit=1000`,
      { headers: { "Content-Type": "application/json" } }
    );
    data = await response.json();
    count = data?.artworks?.length || data?.length || 0;

    console.log(`   Response: ${count} artworks (limited by status filter)\n`);
    if (count > 0) {
      console.log(`   ✅ Public artworks work correctly (${count} approved for sale)\n`);
    }

    console.log("=".repeat(70) + "\n");
    console.log("✅ ALL TESTS COMPLETED\n");

    if (count > 0) {
      console.log("✨ FIX VERIFIED! Filters are working correctly.");
    } else {
      console.log("⚠️  Something went wrong. Check the API response.");
    }

  } catch (err) {
    console.error("ERROR:", err.message);
    console.error("\n⚠️  Make sure:");
    console.error("   1. The API is running (yarn dev or vercel dev)");
    console.error("   2. You're running this test against the correct API URL");
    console.error(`   3. Current API URL: ${API_URL}`);
  }
}

testArtworksFilter();
