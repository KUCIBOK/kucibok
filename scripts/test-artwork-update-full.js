#!/usr/bin/env node

/**
 * Test: Full artwork update flow
 * Tests if updating artwork fields works correctly
 */

const fs = require("fs");
const path = require("path");

// Load env vars
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

async function testArtworkUpdate() {
  console.log(`🔍 Testing Full Artwork Update Flow\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // 1. Get first artwork
    console.log("1️⃣  Fetching first artwork:\n");
    const { data: artworks, error: fetchError } = await supabaseAdmin
      .from("artworks")
      .select("*")
      .eq("user_id", MISSIRA_USER_ID)
      .limit(1);

    if (fetchError || !artworks || artworks.length === 0) {
      console.log(`   ❌ No artworks found!`);
      return;
    }

    const artwork = artworks[0];
    console.log(`   ✅ Artwork ID: ${artwork.id}`);
    console.log(`   ✅ Title: ${artwork.title}`);
    console.log(`   ✅ Price: ${artwork.price}`);
    console.log(`   ✅ For Sale: ${artwork.for_sale}`);
    console.log(`   ✅ Status: ${artwork.status}`);

    console.log("\n");

    // 2. Prepare update payload (test different field types)
    console.log("2️⃣  Preparing update payload:\n");

    const updatePayload = {
      title: artwork.title + " [UPDATED TEST]",
      price: parseFloat(artwork.price) + 10,
      for_sale: !artwork.for_sale, // Toggle it
      description: artwork.description || "Updated description",
      status: artwork.status || "pending",
    };

    console.log(`   ✅ Title: ${updatePayload.title}`);
    console.log(`   ✅ Price (number): ${updatePayload.price}`);
    console.log(`   ✅ For Sale (boolean): ${updatePayload.for_sale}`);
    console.log(`   ✅ Description: ${updatePayload.description.substring(0, 50)}...`);
    console.log(`   ✅ Status: ${updatePayload.status}`);

    console.log("\n");

    // 3. Apply update
    console.log("3️⃣  Applying update via supabaseAdmin:\n");

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("artworks")
      .update(updatePayload)
      .eq("id", artwork.id)
      .select();

    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`);
      return;
    }

    const updatedArtwork = updated[0];
    console.log(`   ✅ Update successful!`);
    console.log(`   ✅ Title: ${updatedArtwork.title}`);
    console.log(`   ✅ Price: ${updatedArtwork.price}`);
    console.log(`   ✅ For Sale: ${updatedArtwork.for_sale}`);
    console.log(`   ✅ Status: ${updatedArtwork.status}`);

    console.log("\n");

    // 4. Verify update
    console.log("4️⃣  Verifying update:\n");

    if (updatedArtwork.title === updatePayload.title) {
      console.log(`   ✅ Title updated correctly`);
    } else {
      console.log(`   ❌ Title not updated`);
    }

    if (updatedArtwork.price === updatePayload.price) {
      console.log(`   ✅ Price updated correctly`);
    } else {
      console.log(`   ❌ Price not updated (${updatedArtwork.price} !== ${updatePayload.price})`);
    }

    if (updatedArtwork.for_sale === updatePayload.for_sale) {
      console.log(`   ✅ For Sale toggled correctly`);
    } else {
      console.log(`   ❌ For Sale not updated`);
    }

    if (updatedArtwork.status === updatePayload.status) {
      console.log(`   ✅ Status updated correctly`);
    } else {
      console.log(`   ❌ Status not updated`);
    }

    console.log("\n" + "=".repeat(70) + "\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

testArtworkUpdate();
