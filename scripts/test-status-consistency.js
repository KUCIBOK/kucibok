#!/usr/bin/env node

/**
 * Test: Verify status consistency across dashboard and catalog
 *
 * Expected behavior:
 * 1. Dashboard shows ACTUAL status from database
 * 2. Catalog shows ONLY 'approved' artworks
 * 3. No mismatches between dashboard and catalog
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

async function testStatusConsistency() {
  console.log(`✅ Test: Status Consistency Across Dashboard & Catalog\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // 1. Dashboard: Get ALL artworks for the artist (regardless of status)
    console.log("1️⃣  DASHBOARD VIEW - Artist sees all their artworks:\n");
    console.log(`   GET /api/artworks?artist_id=${MISSIRA_ARTIST_ID} (no status filter)`);

    let query = supabaseAdmin.from("artworks").select("*");
    query = query.eq("artist_id", MISSIRA_ARTIST_ID);
    query = query.order("created_at", { ascending: false });
    query = query.limit(300);

    const { data: dashboardArtworks } = await query;

    const dashboardStats = {};
    dashboardArtworks?.forEach((a) => {
      dashboardStats[a.status] = (dashboardStats[a.status] || 0) + 1;
    });

    console.log(`\n   Dashboard shows ${dashboardArtworks?.length} artworks`);
    Object.entries(dashboardStats).forEach(([status, count]) => {
      console.log(`      - status='${status}': ${count}`);
    });

    console.log("\n");

    // 2. Catalog: Get only 'approved' artworks (public view)
    console.log("2️⃣  CATALOG VIEW - Public sees only approved artworks:\n");
    console.log(`   GET /api/artworks (no artist_id, applies status='approved' filter)`);

    query = supabaseAdmin.from("artworks").select("*");
    // No artist_id filter — this is PUBLIC
    query = query.eq("status", "approved");
    query = query.order("created_at", { ascending: false });
    query = query.limit(300);

    const { data: catalogArtworks } = await query;

    const catalogForMissira = catalogArtworks?.filter(
      (a) => a.artist_id === MISSIRA_ARTIST_ID
    );

    console.log(`\n   Catalog shows ${catalogForMissira?.length} of Missira's artworks`);

    console.log("\n");

    // 3. Check consistency
    console.log("3️⃣  CONSISTENCY CHECK:\n");

    const dashboardApproved = dashboardArtworks?.filter(
      (a) => a.status === "approved"
    ).length;
    const catalogApproved = catalogForMissira?.length;

    console.log(`   Dashboard (approved): ${dashboardApproved}`);
    console.log(`   Catalog (approved): ${catalogApproved}`);

    if (dashboardApproved === catalogApproved) {
      console.log(`   ✅ Consistent!`);
    } else {
      console.log(
        `   ❌ MISMATCH! Dashboard shows ${dashboardApproved} approved,`
      );
      console.log(`      but catalog only shows ${catalogApproved}`);
    }

    console.log("\n");

    // 4. Verify 'for_sale' doesn't bypass status filter
    console.log("4️⃣  VERIFY for_sale doesn't bypass approval:\n");

    const pendingForSale = dashboardArtworks?.filter(
      (a) => a.status === "pending" && a.for_sale === true
    );

    if (pendingForSale?.length > 0) {
      console.log(
        `   ❌ PROBLEM: Found ${pendingForSale.length} pending artworks with for_sale=true!`
      );
      console.log(`      These should NOT appear in public catalog.`);
      pendingForSale.slice(0, 3).forEach((a) => {
        console.log(`         - ${a.title} (status=${a.status}, for_sale=${a.for_sale})`);
      });
    } else {
      console.log(`   ✅ No 'pending + for_sale' mismatch found`);
    }

    console.log("\n" + "=".repeat(70) + "\n");

    console.log("📋 SUMMARY:\n");
    console.log("Dashboard behavior:");
    console.log("  - Shows ALL artworks (pending, approved, rejected, etc)");
    console.log("  - Artist sees their own work at all stages");
    console.log("\nCatalog behavior:");
    console.log("  - Shows ONLY approved artworks");
    console.log("  - Public sees finished, approved pieces");
    console.log("\nStatus field:");
    console.log("  - Controls visibility and workflow");
    console.log("  - for_sale flag controls if artwork is for sale");
    console.log("  - Status='pending' = awaiting approval, should NOT be public\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

testStatusConsistency();
