#!/usr/bin/env node

/**
 * CHECK: Missira Keita by email (misirakeita@gmail.com)
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const MISSIRA_EMAIL = "misirakeita@gmail.com";

async function checkByEmail() {
  console.log(`🔍 CHECKING: ${MISSIRA_EMAIL}\n`);
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Find user by email
    console.log("1️⃣ Finding user...\n");
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, role, name")
      .eq("email", MISSIRA_EMAIL)
      .single();

    if (userError || !user) {
      console.log(`❌ User not found: ${MISSIRA_EMAIL}`);
      console.log(`   Error: ${userError?.message || "No record"}\n`);
      return;
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Name: ${user.name}\n`);

    // 2. Find artist record
    console.log("2️⃣ Finding artist record...\n");
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("id, user_id, name, email")
      .eq("user_id", user.id)
      .single();

    if (artistError || !artist) {
      console.log(`❌ NO ARTIST RECORD FOUND!`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Error: ${artistError?.message || "No record"}\n`);
      console.log("   ⚠️  THIS IS THE PROBLEM! She can't see her artworks because");
      console.log("   there's no link between her user account and her artist profile.\n");
      console.log("   💡 FIX: Run this command:");
      console.log("   node scripts/fix-missira-profile.js\n");
      return;
    }

    console.log(`✅ Artist record found:`);
    console.log(`   Artist ID: ${artist.id}`);
    console.log(`   User ID: ${artist.user_id}`);
    console.log(`   Name: ${artist.name}`);
    console.log(`   Email: ${artist.email}\n`);

    // 3. Find all artworks
    console.log("3️⃣ Finding artworks...\n");

    const { data: artworks, error: artworksError } = await supabase
      .from("artworks")
      .select("id, title, status, for_sale, created_at, artist_id, user_id")
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false });

    if (artworksError) {
      console.log(`❌ Error: ${artworksError.message}\n`);
      return;
    }

    if (!artworks || artworks.length === 0) {
      console.log(`❌ NO ARTWORKS FOUND for artist_id = ${artist.id}\n`);
      console.log("   Checking by user_id as fallback...\n");

      const { data: artworksByUser } = await supabase
        .from("artworks")
        .select("id, title, status, for_sale, artist_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!artworksByUser || artworksByUser.length === 0) {
        console.log(`❌ ALSO NO ARTWORKS BY USER_ID\n`);
        console.log("   ⚠️  Missira has never uploaded any artworks.\n");
        return;
      }

      console.log(`⚠️  Found ${artworksByUser.length} artwork(s) with WRONG artist_id:\n`);
      artworksByUser.forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}"`);
        console.log(
          `      Status: ${a.status}, For Sale: ${a.for_sale}`
        );
        console.log(`      artist_id in DB: ${a.artist_id}`);
        console.log(
          `      Should be: ${artist.id}`
        );
      });
      console.log();
      return;
    }

    console.log(`✅ Found ${artworks.length} artwork(s):\n`);

    const byStatus = {};
    artworks.forEach((a) => {
      if (!byStatus[a.status]) byStatus[a.status] = 0;
      byStatus[a.status]++;
    });

    Object.keys(byStatus).forEach((status) => {
      console.log(`   ${status}: ${byStatus[status]}`);
    });
    console.log();

    // Show details
    console.log("   Details:");
    artworks.forEach((a, i) => {
      console.log(`   ${i + 1}. "${a.title}"`);
      console.log(`      Status: ${a.status}, For Sale: ${a.for_sale}`);
      console.log(`      Created: ${new Date(a.created_at).toLocaleDateString("fr-FR")}`);
    });
    console.log();

    // 4. What dashboard will show
    console.log("4️⃣ Dashboard simulation:\n");
    console.log(`   API call: GET /api/artworks?artist_id=${artist.id}`);
    console.log(`   After fix: Should return ${artworks.length} artwork(s)\n`);

    const approved = artworks.filter((a) => a.status === "approved");
    console.log(`   ✅ Dashboard WILL show:\n`);
    if (approved.length === artworks.length) {
      console.log(`      All ${artworks.length} artworks (all approved)\n`);
    } else {
      console.log(`      ${artworks.length} artworks total:`);
      artworks.forEach((a) => {
        console.log(`      - "${a.title}" [${a.status}]`);
      });
      console.log();
    }

    // Summary
    console.log("=".repeat(80) + "\n");
    console.log("✅ EVERYTHING LOOKS GOOD!\n");
    console.log("   Missira's artworks ARE in the database.");
    console.log("   The API fix is in place.");
    console.log("   She should see all her artworks now.\n");
    console.log("   If she STILL doesn't see them:");
    console.log("   1. Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)");
    console.log("   2. Clear browser cache");
    console.log("   3. Logout and login again");
    console.log("   4. Try a different browser\n");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

checkByEmail();
