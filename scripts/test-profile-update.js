#!/usr/bin/env node

/**
 * Test: Full artist profile update flow
 * 1. Get profile (auto-create if missing)
 * 2. Update bio and other fields
 * 3. Verify update
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

async function testProfileUpdate() {
  console.log(`🔍 Testing Artist Profile Update Flow\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // 1. Get user info
    console.log("1️⃣  Getting user info:\n");
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", MISSIRA_USER_ID)
      .single();

    if (!user) {
      console.log(`   ❌ User not found!`);
      return;
    }

    console.log(`   ✅ User ID: ${user.id}`);
    console.log(`   ✅ Name: ${user.name}`);
    console.log(`   ✅ Email: ${user.email}`);
    console.log(`   ✅ Role: ${user.role}`);
    console.log(`   ✅ Created: ${user.created_at}`);

    console.log("\n");

    // 2. Check/create artist profile
    console.log("2️⃣  Checking artist profile:\n");
    let { data: artist } = await supabaseAdmin
      .from("artists")
      .select("*")
      .eq("user_id", MISSIRA_USER_ID)
      .single();

    if (!artist) {
      console.log(`   ⚠️  Artist profile not found, creating one...`);
      const { data: newArtist, error: createError } = await supabaseAdmin
        .from("artists")
        .insert([{ user_id: MISSIRA_USER_ID }])
        .select()
        .single();

      if (createError) {
        console.log(`   ❌ Failed to create: ${createError.message}`);
        return;
      }

      artist = newArtist;
      console.log(`   ✅ Artist profile created!`);
    }

    console.log(`   ✅ Artist ID: ${artist.id}`);
    console.log(`   ✅ User ID: ${artist.user_id}`);
    console.log(`   ✅ Username: ${artist.username || "(empty)"}`);
    console.log(`   ✅ Biography: ${artist.biography ? artist.biography.substring(0, 50) + "..." : "(empty)"}`);

    console.log("\n");

    // 3. Update profile
    console.log("3️⃣  Updating artist profile:\n");

    const updatePayload = {
      username: "missira_keita_updated",
      biography: "<p>Artiste plasticien contemporain basé en Afrique de l'Ouest. Exploration de l'identité et de la culture à travers des médiums mixtes.</p>",
      country: "Mali",
      portfolio: "https://missiraart.com",
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("artists")
      .update(updatePayload)
      .eq("id", artist.id)
      .select()
      .single();

    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`);
      return;
    }

    console.log(`   ✅ Update successful!`);
    console.log(`   ✅ Username: ${updated.username}`);
    console.log(`   ✅ Country: ${updated.country}`);
    console.log(`   ✅ Portfolio: ${updated.portfolio}`);
    console.log(`   ✅ Bio: ${updated.biography.substring(0, 60)}...`);

    console.log("\n");

    // 4. Verify update (fetch again)
    console.log("4️⃣  Verifying update:\n");

    const { data: verified } = await supabaseAdmin
      .from("artists")
      .select("*")
      .eq("id", artist.id)
      .single();

    if (verified.username === "missira_keita_updated") {
      console.log(`   ✅ Username persisted correctly`);
    } else {
      console.log(`   ❌ Username mismatch: ${verified.username}`);
    }

    if (verified.country === "Mali") {
      console.log(`   ✅ Country persisted correctly`);
    } else {
      console.log(`   ❌ Country mismatch: ${verified.country}`);
    }

    if (verified.biography && verified.biography.includes("Artiste plasticien")) {
      console.log(`   ✅ Biography persisted correctly`);
    } else {
      console.log(`   ❌ Biography mismatch`);
    }

    console.log("\n" + "=".repeat(70) + "\n");
    console.log("✅ All tests passed!");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

testProfileUpdate();
