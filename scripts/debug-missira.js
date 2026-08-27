#!/usr/bin/env node

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

async function debugMissira() {
  console.log("🔍 DEBUG: Missira's artwork situation\n");
  console.log("=".repeat(70) + "\n");

  try {
    // Check if Missira's artist record exists
    console.log("1️⃣  Checking Missira's artist record:\n");
    const { data: artist } = await supabaseAdmin
      .from("artists")
      .select("*")
      .eq("id", MISSIRA_ARTIST_ID)
      .single();

    if (artist) {
      console.log(`   ✅ Artist exists: ${artist.name}`);
      console.log(`      ID: ${artist.id}`);
      console.log(`      user_id: ${artist.user_id}`);
    } else {
      console.log(`   ❌ Artist record NOT found!`);
    }

    console.log("\n");

    // Check artworks for Missira by different filters
    console.log("2️⃣  Checking artworks linked to Missira:\n");

    // By user_id
    const { data: byUserId } = await supabaseAdmin
      .from("artworks")
      .select("id, title, artist_id, user_id")
      .eq("user_id", MISSIRA_USER_ID);
    console.log(`   By user_id: ${byUserId?.length || 0} artworks`);

    // By artist_id
    const { data: byArtistId } = await supabaseAdmin
      .from("artworks")
      .select("id, title, artist_id, user_id")
      .eq("artist_id", MISSIRA_ARTIST_ID);
    console.log(`   By artist_id: ${byArtistId?.length || 0} artworks`);

    console.log("\n");

    // Show sample of artworks
    if (byArtistId && byArtistId.length > 0) {
      console.log(`📋 Sample of Missira's artworks (by artist_id):\n`);
      byArtistId.slice(0, 5).forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}"`);
        console.log(`      artist_id: ${a.artist_id}`);
        console.log(`      user_id: ${a.user_id}`);
      });
    } else if (byUserId && byUserId.length > 0) {
      console.log(`📋 Sample of artworks created by Missira (by user_id):\n`);
      byUserId.slice(0, 5).forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}"`);
        console.log(`      artist_id: ${a.artist_id}`);
        console.log(`      user_id: ${a.user_id}`);
      });
    }

    console.log("\n");

    // Check the artist_ids of these artworks
    if (byUserId && byUserId.length > 0) {
      console.log("3️⃣  Checking if those artist_ids reference actual artists:\n");

      const uniqueArtistIds = [...new Set(byUserId.map(a => a.artist_id).filter(Boolean))];

      for (const artId of uniqueArtistIds) {
        const { data: refArtist } = await supabaseAdmin
          .from("artists")
          .select("id, name")
          .eq("id", artId)
          .single();

        console.log(`   artist_id ${artId.substring(0, 8)}...`);
        if (refArtist) {
          console.log(`      ✅ References: ${refArtist.name}`);
        } else {
          console.log(`      ❌ No artist found with this ID!`);
        }
      }
    }

    console.log("\n" + "=".repeat(70) + "\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

debugMissira();
