#!/usr/bin/env node

/**
 * Diagnose: Why Missira's artworks show 'draft' on dashboard but 'for sale' in catalog
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

const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function diagnose() {
  console.log(`🔍 Diagnosing Missira's artwork status mismatch\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Get all of Missira's artworks
    console.log("1️⃣  Fetching Missira's artworks:\n");
    const { data: artworks } = await supabaseAdmin
      .from("artworks")
      .select("id, title, status, for_sale, availability_status")
      .eq("artist_id", MISSIRA_ARTIST_ID);

    console.log(`   Found ${artworks?.length || 0} artworks\n`);

    if (artworks && artworks.length > 0) {
      console.log("   Details:\n");
      artworks.slice(0, 9).forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}"`);
        console.log(`      status: ${a.status}`);
        console.log(`      for_sale: ${a.for_sale}`);
        console.log(`      availability_status: ${a.availability_status}`);
      });
    }

    console.log("\n");

    // Analyze status distribution
    console.log("2️⃣  Status distribution:\n");

    const statusCount = {};
    const forSaleCount = {};
    const combinationCount = {};

    artworks?.forEach((a) => {
      statusCount[a.status] = (statusCount[a.status] || 0) + 1;
      forSaleCount[a.for_sale] = (forSaleCount[a.for_sale] || 0) + 1;

      const combo = `${a.status} + for_sale=${a.for_sale}`;
      combinationCount[combo] = (combinationCount[combo] || 0) + 1;
    });

    console.log("   By status field:");
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`      ${status}: ${count} artworks`);
    });

    console.log("\n   By for_sale field:");
    Object.entries(forSaleCount).forEach(([forSale, count]) => {
      console.log(`      for_sale=${forSale}: ${count} artworks`);
    });

    console.log("\n   Status + for_sale combinations:");
    Object.entries(combinationCount).forEach(([combo, count]) => {
      console.log(`      ${combo}: ${count} artworks`);
    });

    console.log("\n");

    // Check if there's a mismatch
    console.log("3️⃣  Problem Analysis:\n");

    const haveBrouillonStatus = artworks?.some((a) => a.status === "pending");
    const areForSale = artworks?.some((a) => a.for_sale === true);

    if (haveBrouillonStatus && areForSale) {
      console.log(`   ❌ PROBLEM FOUND!`);
      console.log(`      - Some artworks have status='pending' (brouillon)`);
      console.log(`      - But also have for_sale=true`);
      console.log(`      - Dashboard shows 'pending', catalog shows 'for sale'`);

      console.log("\n   🔧 ROOT CAUSE:");
      console.log(`      The 'status' field controls approval/visibility`);
      console.log(`      - status='pending' = waiting for admin approval`);
      console.log(`      - status='approved' = approved and visible`);
      console.log(`      But the 'for_sale' flag bypasses this somehow`);

      console.log("\n   📊 SOLUTION:");
      console.log(`      1. Set status='approved' for all Missira's artworks`);
      console.log(`      2. Keep for_sale=true for those she wants to sell`);
      console.log(`      3. Verify the filter logic in API and frontend`);
    } else if (!haveBrouillonStatus && areForSale) {
      console.log(`   ✅ Status looks correct`);
      console.log(`      - All artworks have proper status`);
      console.log(`      - They are for sale as expected`);
    }

    console.log("\n" + "=".repeat(70) + "\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

diagnose();
