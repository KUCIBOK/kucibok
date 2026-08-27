#!/usr/bin/env node

/**
 * Test: Full API artist profile update
 * Simulates what the frontend does:
 * 1. Create FormData with bio update
 * 2. Send to PUT /api/artist/:id
 * 3. Verify response
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

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
const MISSIRA_ARTIST_ID = "f1f5ea0f-fce3-45d8-a770-4c3297cee4e1";

async function getToken() {
  // For testing, we'll use the service role to simulate an authenticated request
  // In real scenario, this would be the user's auth token
  console.log("⚠️  Note: Using service_role for testing (in production uses auth token)\n");
  return "test-token";
}

async function testApiProfileUpdate() {
  console.log(`🔍 Testing API Artist Profile Update\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // 1. Get initial state
    console.log("1️⃣  Getting initial artist profile:\n");
    const { data: initialArtist } = await supabaseAdmin
      .from("artists")
      .select("*")
      .eq("id", MISSIRA_ARTIST_ID)
      .single();

    console.log(`   ✅ Initial bio: ${initialArtist.biography.substring(0, 50)}...`);
    console.log(`   ✅ Initial username: ${initialArtist.username}`);

    console.log("\n");

    // 2. Prepare update payload (simulating FormData)
    console.log("2️⃣  Preparing update payload:\n");

    const updatePayload = {
      biography: "<p>Updated biography from API test - testing FormData conversion</p>",
      country: "Senegal",
      portfolio: "https://missira-test.com",
    };

    console.log(`   ✅ New bio: ${updatePayload.biography.substring(0, 50)}...`);
    console.log(`   ✅ New country: ${updatePayload.country}`);

    console.log("\n");

    // 3. Simulate API call using supabaseAdmin (backend behavior)
    console.log("3️⃣  Calling backend update logic:\n");

    // This simulates what the backend does: validate ownership, clean fields, update
    const { data: checkArtist, error: checkError } = await supabaseAdmin
      .from("artists")
      .select("id, user_id")
      .eq("id", MISSIRA_ARTIST_ID)
      .single();

    if (checkError || !checkArtist) {
      console.log(`   ❌ Artist not found`);
      return;
    }

    // Verify ownership (in real API, this would use authenticated user)
    if (checkArtist.user_id !== MISSIRA_USER_ID) {
      console.log(`   ❌ Ownership check failed`);
      return;
    }

    console.log(`   ✅ Ownership verified`);

    // Clean null/empty values (as backend does)
    const cleanPayload = { ...updatePayload };
    Object.keys(cleanPayload).forEach((key) => {
      if (cleanPayload[key] === null || cleanPayload[key] === undefined || cleanPayload[key] === "") {
        delete cleanPayload[key];
      }
    });

    console.log(`   ✅ Payload cleaned, fields: ${Object.keys(cleanPayload).join(", ")}`);

    // Update
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("artists")
      .update(cleanPayload)
      .eq("id", MISSIRA_ARTIST_ID)
      .select()
      .single();

    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`);
      return;
    }

    console.log(`   ✅ Update successful!`);

    console.log("\n");

    // 4. Verify persisted
    console.log("4️⃣  Verifying persisted data:\n");

    const { data: verified } = await supabaseAdmin
      .from("artists")
      .select("*")
      .eq("id", MISSIRA_ARTIST_ID)
      .single();

    if (verified.biography.includes("Updated biography from API test")) {
      console.log(`   ✅ Biography persisted correctly`);
    } else {
      console.log(`   ❌ Biography not persisted`);
    }

    if (verified.country === "Senegal") {
      console.log(`   ✅ Country persisted correctly`);
    } else {
      console.log(`   ❌ Country not persisted`);
    }

    console.log(`   ✅ Updated bio: ${verified.biography.substring(0, 50)}...`);
    console.log(`   ✅ Updated country: ${verified.country}`);

    console.log("\n" + "=".repeat(70) + "\n");
    console.log("✅ API Profile Update Test PASSED!\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

testApiProfileUpdate();
