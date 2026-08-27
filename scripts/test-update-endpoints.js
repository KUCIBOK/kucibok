#!/usr/bin/env node

/**
 * Test: Artist & Artwork update endpoints
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

const MISSIRA_USER_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function testUpdateEndpoints() {
  console.log(`🔍 Testing Update Endpoints\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // 1. Check artist record
    console.log("1️⃣  Checking Missira's artist record:\n");
    const { data: artist } = await supabaseAdmin
      .from("artists")
      .select("*")
      .eq("id", MISSIRA_ARTIST_ID)
      .single();

    if (artist) {
      console.log(`   ✅ Artist ID: ${artist.id}`);
      console.log(`   ✅ User ID: ${artist.user_id}`);
    } else {
      console.log(`   ❌ Artist not found!`);
      return;
    }

    console.log("\n");

    // 2. Check an artwork
    console.log("2️⃣  Checking Missira's first artwork:\n");
    const { data: artworks } = await supabaseAdmin
      .from("artworks")
      .select("*")
      .eq("artist_id", MISSIRA_ARTIST_ID)
      .limit(1);

    if (artworks && artworks.length > 0) {
      const artwork = artworks[0];
      console.log(`   ✅ Artwork ID: ${artwork.id}`);
      console.log(`   ✅ User ID: ${artwork.user_id}`);
      console.log(`   ✅ Title: ${artwork.title}`);
    } else {
      console.log(`   ❌ No artworks found!`);
      return;
    }

    const artwork = artworks[0];

    console.log("\n");

    // 3. Build API URLs
    console.log("3️⃣  API endpoints to test:\n");

    const artistEndpoint = `/api/artist/${artist.id}`;
    const artworkEndpoint = `/api/artworks/${artwork.id}`;

    console.log(`   Artist update: PUT ${artistEndpoint}`);
    console.log(`   Artwork update: PUT ${artworkEndpoint}`);

    console.log("\n");

    // 4. Parse URLs
    console.log("4️⃣  URL parsing:\n");

    const artistPath = artistEndpoint.replace(/^\/api\//, "").split("/").filter(p => p);
    const artworkPath = artworkEndpoint.replace(/^\/api\//, "").split("/").filter(p => p);

    console.log(`   Artist path: [${artistPath.join(", ")}]`);
    console.log(`      s0: "${artistPath[0]}" (should be "artist")`);
    console.log(`      s1: "${artistPath[1]}" (should be artist ID)`);

    console.log(`\n   Artwork path: [${artworkPath.join(", ")}]`);
    console.log(`      s0: "${artworkPath[0]}" (should be "artworks")`);
    console.log(`      s1: "${artworkPath[1]}" (should be artwork ID)`);

    console.log("\n" + "=".repeat(70) + "\n");

    if (artistPath[0] === "artist" && artistPath[1] === artist.id) {
      console.log(`✅ Artist endpoint looks CORRECT`);
    } else {
      console.log(`❌ Artist endpoint WRONG!`);
    }

    if (artworkPath[0] === "artworks" && artworkPath[1] === artwork.id) {
      console.log(`✅ Artwork endpoint looks CORRECT`);
    } else {
      console.log(`❌ Artwork endpoint WRONG!`);
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

testUpdateEndpoints();
