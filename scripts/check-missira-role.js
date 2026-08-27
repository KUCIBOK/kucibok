#!/usr/bin/env node

/**
 * Check: What is Missira's user role and artist status?
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

async function checkMissiraRole() {
  console.log(`🔍 Checking Missira's roles and status\n`);
  console.log("=".repeat(70) + "\n");

  try {
    // Check user table
    console.log("1️⃣  User record:\n");
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", MISSIRA_USER_ID)
      .single();

    if (user) {
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Profile completed: ${user.profile_completed}`);
    } else {
      console.log(`   ❌ User not found!`);
    }

    console.log("\n");

    // Check artist table
    console.log("2️⃣  Artist record:\n");
    const { data: artist } = await supabaseAdmin
      .from("artists")
      .select("*")
      .eq("id", MISSIRA_ARTIST_ID)
      .single();

    if (artist) {
      console.log(`   Name: ${artist.name}`);
      console.log(`   User ID: ${artist.user_id}`);
      console.log(`   Username: ${artist.username}`);
      console.log(`   Country: ${artist.country}`);
    } else {
      console.log(`   ❌ Artist not found!`);
    }

    console.log("\n");

    // Check consistency
    console.log("3️⃣  Consistency checks:\n");

    if (user?.role === "artist") {
      console.log(`   ✅ User role is 'artist'`);
    } else if (user?.role === "curator") {
      console.log(`   ⚠️  User role is 'curator' (not 'artist')`);
    } else if (user?.role === "buyer") {
      console.log(`   ⚠️  User role is 'buyer' (not 'artist')`);
      console.log(`      ⚠️  Dashboard will not show 'Statut' column for buyers!`);
    } else {
      console.log(`   ❌ User role is '${user?.role}'`);
    }

    if (artist?.user_id === MISSIRA_USER_ID) {
      console.log(`   ✅ Artist.user_id matches User.id`);
    } else {
      console.log(`   ❌ Artist.user_id (${artist?.user_id}) != User.id`);
    }

    console.log("\n" + "=".repeat(70) + "\n");

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

checkMissiraRole();
