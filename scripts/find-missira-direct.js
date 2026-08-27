#!/usr/bin/env node

/**
 * FIND Missira directly by checking all records
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function find() {
  console.log("🔍 FINDING MISSIRA...\n");

  try {
    // 1. Check if she's in public.users (by trying ID from earlier)
    const missiraId = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";

    console.log("Trying direct ID lookup:", missiraId, "\n");
    const { data: publicUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", missiraId);

    if (publicUser && publicUser.length > 0) {
      console.log("✅ Found in public.users:\n");
      const u = publicUser[0];
      console.log(`   ID: ${u.id}`);
      console.log(`   Name: ${u.name}`);
      console.log(`   Role: ${u.role}`);
      console.log(`   Created: ${u.created_at}\n`);
    } else {
      console.log("❌ NOT in public.users\n");
    }

    // 2. Check artists
    console.log("Checking artists...\n");
    const { data: artists } = await supabase
      .from("artists")
      .select("*")
      .eq("user_id", missiraId);

    if (artists && artists.length > 0) {
      console.log(`✅ Found ${artists.length} artist record(s):\n`);
      artists.forEach((a, i) => {
        console.log(`   ${i + 1}. Artist ID: ${a.id}, Name: ${a.name}`);
      });
      console.log();

      // Check artworks for each artist
      for (const artist of artists) {
        console.log(`Checking artworks for artist ${artist.id}...\n`);
        const { data: artworks } = await supabase
          .from("artworks")
          .select("id, title, status, created_at")
          .eq("artist_id", artist.id);

        if (artworks && artworks.length > 0) {
          console.log(`✅ Found ${artworks.length} artwork(s):\n`);
          artworks.forEach((a, i) => {
            console.log(`   ${i + 1}. "${a.title}" [${a.status}]`);
          });
        } else {
          console.log(`❌ NO artworks for this artist\n`);
        }
      }
    } else {
      console.log("❌ NO artist records\n");
    }

    // 3. Also check by name pattern (like "Missira" or "Keita")
    console.log("\n3️⃣ Searching by name pattern (Missira/Keita)...\n");
    const { data: usersByName } = await supabase
      .from("users")
      .select("*")
      .ilike("name", "%issira%");

    if (usersByName && usersByName.length > 0) {
      console.log(`✅ Found ${usersByName.length} user(s):\n`);
      usersByName.forEach((u) => {
        console.log(`   ${u.name} (${u.id})`);
      });
    } else {
      console.log("❌ No users found with 'issira' in name\n");
    }

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

find();
