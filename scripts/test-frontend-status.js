#!/usr/bin/env node

/**
 * Test: What status does the frontend GET /api/artworks return for Missira?
 */

const fs = require("fs");
const path = require("path");

const API_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function testFrontendStatus() {
  console.log(`🔍 Testing Frontend API Response for Missira\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Test 1: Fetch by artist_id
    console.log("1️⃣  GET /api/artworks?artist_id=<missira_id>\n");
    console.log(`   ${API_URL}/api/artworks?artist_id=${MISSIRA_ARTIST_ID}`);

    const response = await fetch(
      `${API_URL}/api/artworks?artist_id=${MISSIRA_ARTIST_ID}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      console.log(`   ❌ Request failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    const artworks = data?.artworks || data?.data || [];

    console.log(`\n   Response contains ${artworks.length} artworks\n`);

    if (artworks.length > 0) {
      console.log("   Statuses returned:");
      artworks.slice(0, 9).forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}"`);
        console.log(`      status: ${a.status}`);
        console.log(`      for_sale: ${a.for_sale}`);
      });
    }

    console.log("\n" + "=".repeat(70) + "\n");

    // Analyze
    const statuses = {};
    artworks.forEach((a) => {
      statuses[a.status] = (statuses[a.status] || 0) + 1;
    });

    console.log("📊 Status Distribution (what frontend receives):\n");
    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log("\n");
    console.log("✅ If you see 'pending', that's the bug!");
    console.log("   The API is returning status='pending' but DB has 'approved'");

  } catch (err) {
    console.error("ERROR:", err.message);
    console.error("\n⚠️  Make sure the API is running!");
  }
}

testFrontendStatus();
