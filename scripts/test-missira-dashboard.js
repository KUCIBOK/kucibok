#!/usr/bin/env node

/**
 * TEST: Missira's dashboard flow end-to-end
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function test() {
  console.log("🔍 TESTING MISSIRA'S DASHBOARD FLOW...\n");
  console.log("=".repeat(80) + "\n");

  const MISSIRA_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";

  try {
    // 1. Get user profile
    console.log("1️⃣ Simulating: getUserProfile(MISSIRA_ID)\n");

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', MISSIRA_ID)
      .single();

    console.log(`   User role: ${userData?.role}\n`);

    // 2. If artist, get artist profile
    if (userData?.role === 'artist') {
      console.log("2️⃣ Simulating: get artist profile from /api/profile/:id\n");

      const { data: artistData, error: artistError } = await supabaseAdmin
        .from('artists')
        .select('*')
        .eq('user_id', MISSIRA_ID)
        .single();

      if (artistError) {
        console.log(`   ❌ Error: ${artistError.message}\n`);
        return;
      }

      if (!artistData) {
        console.log("   ❌ No artist profile found\n");
        return;
      }

      console.log(`   ✅ Artist profile found:`);
      console.log(`      Artist ID: ${artistData.id}`);
      console.log(`      Name: ${artistData.name}`);
      console.log(`      User ID: ${artistData.user_id}\n`);

      // 3. Now fetch artworks using artist.id
      console.log("3️⃣ Simulating: getMyArtworks(artistData.id)\n");
      console.log(`   Query: GET /api/artworks?artist_id=${artistData.id}\n`);

      const { data: artworks, error: artworksError } = await supabaseAdmin
        .from('artworks')
        .select('id, title, status, created_at')
        .eq('artist_id', artistData.id);

      if (artworksError) {
        console.log(`   ❌ Error: ${artworksError.message}\n`);
        return;
      }

      if (!artworks || artworks.length === 0) {
        console.log("   ❌ No artworks found with artist_id\n");

        // Fallback: try with user_id
        console.log("   Trying fallback: user_id\n");
        const { data: artworksByUser } = await supabaseAdmin
          .from('artworks')
          .select('id, title, status')
          .eq('user_id', MISSIRA_ID);

        if (artworksByUser && artworksByUser.length > 0) {
          console.log(`   ⚠️  Found ${artworksByUser.length} artworks with user_id (not artist_id)\n`);
        }
        return;
      }

      console.log(`   ✅ Found ${artworks.length} artwork(s):\n`);
      artworks.forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}" [${a.status}]`);
      });
      console.log();

      // 4. Summary
      console.log("=".repeat(80) + "\n");
      console.log("✅ MISSIRA'S DASHBOARD SHOULD WORK:\n");
      console.log(`   User profile: ✅ Loaded`);
      console.log(`   Artist ID: ✅ ${artistData.id}`);
      console.log(`   Artworks: ✅ ${artworks.length} visible\n`);
    }

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

test();
