#!/usr/bin/env node

/**
 * DIAGNOSE: Vérifier tous les artworks de Missira et leur statut/visibilité
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function diagnoseMissira() {
  console.log("🔍 DIAGNOSING MISSIRA KEITA ARTWORKS\n");
  console.log("=".repeat(80) + "\n");

  try {
    // Get all artworks by Missira (regardless of status)
    const { data: allArtworks, error } = await supabase
      .from("artworks")
      .select("id, title, status, for_sale, artist_id, user_id, created_at")
      .eq("artist_id", MISSIRA_ARTIST_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching artworks:", error.message);
      return;
    }

    console.log(`📊 TOTAL ARTWORKS BY MISSIRA: ${allArtworks?.length || 0}\n`);

    if (!allArtworks || allArtworks.length === 0) {
      console.log("⚠️  No artworks found for Missira Keita!");
      return;
    }

    // Group by status
    const byStatus = {};
    allArtworks.forEach((aw) => {
      if (!byStatus[aw.status]) {
        byStatus[aw.status] = [];
      }
      byStatus[aw.status].push(aw);
    });

    console.log("📋 BREAKDOWN BY STATUS:\n");
    Object.keys(byStatus).forEach((status) => {
      console.log(`   ${status.toUpperCase()}: ${byStatus[status].length}`);
    });

    console.log("\n" + "=".repeat(80) + "\n");

    // Detailed listing
    console.log("📝 DETAILED LISTING:\n");
    allArtworks.forEach((aw, idx) => {
      console.log(`${idx + 1}. "${aw.title}"`);
      console.log(`   ID: ${aw.id}`);
      console.log(`   Status: ${aw.status}`);
      console.log(`   For Sale: ${aw.for_sale}`);
      console.log(`   Artist ID: ${aw.artist_id}`);
      console.log(`   User ID: ${aw.user_id}`);
      console.log(`   Created: ${new Date(aw.created_at).toLocaleDateString("fr-FR")}`);
      console.log("");
    });

    // Analyze what the API will return
    console.log("=".repeat(80) + "\n");
    console.log("🔗 API BEHAVIOR ANALYSIS:\n");

    const approvedOnly = allArtworks.filter((a) => a.status === "approved");
    console.log(`   GET /api/artworks?artist_id=... (DEFAULT, no status param)`);
    console.log(`   → Returns: ${approvedOnly.length} artworks (APPROVED ONLY)`);
    console.log(`   → Missing: ${allArtworks.length - approvedOnly.length} artworks\n`);

    const notShown = allArtworks.filter((a) => a.status !== "approved");
    if (notShown.length > 0) {
      console.log(`   ❌ HIDDEN ARTWORKS (NOT SHOWN TO ARTIST):\n`);
      notShown.forEach((aw) => {
        console.log(`      - "${aw.title}" [status: ${aw.status}]`);
      });
    }

    console.log("\n" + "=".repeat(80) + "\n");
    console.log("💡 SOLUTION:\n");
    console.log("   The API defaults to status='approved' when fetching artworks.");
    console.log("   Artists should see ALL their artworks, not just approved ones.\n");
    console.log("   Fix: Modify the API to NOT apply status filter when fetching");
    console.log("   artworks for the authenticated artist (artist_id param).\n");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

diagnoseMissira();
