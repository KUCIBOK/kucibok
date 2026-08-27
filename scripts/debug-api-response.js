#!/usr/bin/env node

/**
 * Debug: What EXACTLY does the API return for Missira's artworks?
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

async function debugApiResponse() {
  console.log(`🔍 Debug: Raw API Response\n`);
  console.log("=".repeat(70) + "\n");

  try {
    let query = supabaseAdmin.from("artworks").select("*");
    query = query.eq("artist_id", MISSIRA_ARTIST_ID);
    query = query.order("created_at", { ascending: false });
    query = query.limit(300);

    const { data: filteredArtworks } = await query;

    console.log("Raw response (first artwork):\n");

    if (filteredArtworks && filteredArtworks.length > 0) {
      const firstArtwork = filteredArtworks[0];
      console.log("Keys in response:");
      Object.keys(firstArtwork).forEach((key) => {
        const value = firstArtwork[key];
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      });

      console.log("\n");
      console.log("Key fields:");
      console.log(`  status: "${firstArtwork.status}" (type: ${typeof firstArtwork.status})`);
      console.log(`  created_at: "${firstArtwork.created_at}" (type: ${typeof firstArtwork.created_at})`);
      console.log(`  created: "${firstArtwork.created}" (type: ${typeof firstArtwork.created})`);

      console.log("\n");
      console.log("All artworks statuses:");
      filteredArtworks.forEach((a, i) => {
        console.log(`  ${i + 1}. "${a.title}" → status="${a.status}"`);
      });
    }

    console.log("\n" + "=".repeat(70) + "\n");

    // Now simulate what the API endpoint would return
    console.log("After backend mapping (what API returns):\n");

    const artworkIds = (filteredArtworks || []).map(a => a.artist_id).filter(Boolean)
    let artistData = {}

    if (artworkIds.length > 0) {
      const { data: artists } = await supabaseAdmin
        .from("artists")
        .select("id, name")
        .in("id", artworkIds)

      artists?.forEach(a => {
        artistData[a.id] = a
      })
    }

    const artworksWithArtistNames = (filteredArtworks || []).map((artwork) => ({
      ...artwork,
      artist: artistData[artwork.artist_id]?.name || artwork.artist || "Unknown artist",
    }))

    if (artworksWithArtistNames.length > 0) {
      const first = artworksWithArtistNames[0];
      console.log("First artwork after mapping:");
      console.log(`  status: "${first.status}"`);
      console.log(`  created_at: "${first.created_at}"`);
      console.log(`  artist: "${first.artist}"`);
    }

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

debugApiResponse();
