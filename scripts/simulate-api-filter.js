#!/usr/bin/env node

/**
 * Simulate: What does the API endpoint return for Missira's artworks?
 * This simulates the GET /api/artworks?artist_id=<id> logic
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

async function simulateApiFilter() {
  console.log(`🔍 Simulating API Filter Logic\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // This is what the API does (from api/[...path].js line 174-186)
    console.log("Executing backend query:\n");
    console.log(`  let query = supabaseAdmin.from('artworks').select('*')`);
    console.log(`  query = query.eq('artist_id', '${MISSIRA_ARTIST_ID}')`);
    console.log(`  query = query.order('created_at', { ascending: false })`);
    console.log(`  query = query.limit(300)`);

    // This is the exact query from the backend
    let query = supabaseAdmin.from("artworks").select("*");
    query = query.eq("artist_id", MISSIRA_ARTIST_ID);
    query = query.order("created_at", { ascending: false });
    query = query.limit(300);

    const { data: filteredArtworks, error } = await query;

    console.log(`\n✅ Query executed`);
    console.log(`   Result: ${filteredArtworks?.length || 0} artworks\n`);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return;
    }

    // Display results
    if (filteredArtworks && filteredArtworks.length > 0) {
      console.log("📋 Artworks returned by API:\n");

      filteredArtworks.slice(0, 9).forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}"`);
        console.log(`      status: "${a.status}"`);
        console.log(`      for_sale: ${a.for_sale}`);
      });
    }

    console.log("\n" + "=".repeat(70) + "\n");

    // Analyze statuses
    const statuses = {};
    filteredArtworks?.forEach((a) => {
      statuses[a.status] = (statuses[a.status] || 0) + 1;
    });

    console.log("📊 What API returns to frontend:\n");
    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`   status='${status}': ${count} artworks`);
    });

    console.log("\n");

    if (statuses["pending"]) {
      console.log(`❌ PROBLEM: API is returning status='pending' to frontend!`);
      console.log(`   The frontend will then display 'brouillon' (draft)`);
      console.log(`   Even though for_sale=${filteredArtworks?.[0]?.for_sale}`);
    } else if (statuses["approved"]) {
      console.log(`✅ API correctly returns status='approved' to frontend`);
      console.log(`   The issue must be in HOW the frontend displays it`);
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

simulateApiFilter();
