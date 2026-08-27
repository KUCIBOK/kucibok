#!/usr/bin/env node

/**
 * Direct Supabase test: Verify the filter-before-select logic works
 * This tests the EXACT query logic from the fixed api/[...path].js
 */

// Load environment variables
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

const MISSIRA_USER_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function testSupabaseFilters() {
  console.log(`🔍 Testing Supabase Filter Logic (Direct)\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Test the OLD way (broken) — select FIRST, then filter
    console.log("❌ OLD WAY (broken):\n");
    console.log('   query = supabaseAdmin.from("artworks").select("*, artists(id, name)")');
    console.log('   query = query.eq("user_id", "' + MISSIRA_USER_ID + '")');
    console.log('   query = query.order("created_at", { ascending: false }).limit(300)\n');

    let query = supabaseAdmin.from('artworks').select('*, artists(id, name)');
    query = query.eq('user_id', MISSIRA_USER_ID);
    query = query.order('created_at', { ascending: false }).limit(300);

    const { data: oldData, error: oldError } = await query;
    const oldCount = oldData?.length || 0;

    if (oldError) {
      console.log(`   Error: ${oldError.message}`);
    } else {
      console.log(`   Result: ${oldCount} artworks\n`);
      if (oldCount === 300) {
        console.log(`   ❌ STILL BROKEN! Returns all 300 instead of filtering\n`);
      } else if (oldCount === 9) {
        console.log(`   ✅ Actually this works! (unexpected)\n`);
      }
    }

    // Test the NEW way (fixed) — filter FIRST, then select
    console.log("✅ NEW WAY (fixed):\n");
    console.log('   query = supabaseAdmin.from("artworks")');
    console.log('   query = query.eq("user_id", "' + MISSIRA_USER_ID + '")');
    console.log('   query = query.select("*, artists(id, name)")');
    console.log('   query = query.order("created_at", { ascending: false }).limit(300)\n');

    let query2 = supabaseAdmin.from('artworks');
    query2 = query2.eq('user_id', MISSIRA_USER_ID);
    query2 = query2.select('*, artists(id, name)');
    query2 = query2.order('created_at', { ascending: false }).limit(300);

    const { data: newData, error: newError } = await query2;
    const newCount = newData?.length || 0;

    if (newError) {
      console.log(`   Error: ${newError.message}`);
    } else {
      console.log(`   Result: ${newCount} artworks\n`);
      if (newCount === 9) {
        console.log(`   ✅ FIXED! Returns only Missira's 9 artworks\n`);
      } else if (newCount === 300) {
        console.log(`   ❌ Still broken! Still returns all 300\n`);
      } else {
        console.log(`   ⚠️  Got ${newCount} artworks (expected 9)\n`);
      }
    }

    // Show sample of data
    if (newData && newData.length > 0) {
      console.log("Sample of Missira's artworks:");
      newData.slice(0, 3).forEach((artwork, i) => {
        console.log(`  ${i + 1}. "${artwork.title}" (artist: ${artwork.artists?.name || "Unknown"})`);
      });
      console.log();
    }

    console.log("=".repeat(70) + "\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

testSupabaseFilters();
