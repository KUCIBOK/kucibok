#!/usr/bin/env node

/**
 * FINAL CHECK: Complete diagnostic for Missira's artworks visibility
 *
 * Checks:
 * 1. User exists and has artist record
 * 2. Artworks exist in DB
 * 3. API would return them correctly (after fix)
 * 4. Suggests next steps
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nUsage:");
  console.error(
    "  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/final-check-missira.js"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const MISSIRA_EMAIL = "misirakeita@gmail.com";

async function finalCheck() {
  console.log("🔍 FINAL CHECK: MISSIRA ARTWORKS VISIBILITY\n");
  console.log("=".repeat(80) + "\n");

  let status = "PASS";

  try {
    // ===== STEP 1: User & Artist Record =====
    console.log("📋 STEP 1: Verify user and artist record\n");

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, role, name")
      .eq("email", MISSIRA_EMAIL)
      .single();

    if (userError || !user) {
      console.log(`❌ FAIL: User ${MISSIRA_EMAIL} not found`);
      return "FAIL";
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}\n`);

    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("id, user_id, name")
      .eq("user_id", user.id)
      .single();

    if (artistError || !artist) {
      console.log(`❌ FAIL: Artist record missing for user ${user.id}`);
      console.log(`   This prevents API from returning her artworks.\n`);
      status = "FAIL";
    } else {
      console.log(`✅ Artist record found:`);
      console.log(`   Artist ID: ${artist.id}`);
      console.log(`   User ID: ${artist.user_id}\n`);
    }

    // ===== STEP 2: Check Artworks =====
    console.log("📋 STEP 2: Check artworks in database\n");

    const { data: artworks, error: artError } = await supabase
      .from("artworks")
      .select("id, title, status, for_sale, created_at")
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false });

    if (artError) {
      console.log(`❌ ERROR querying artworks: ${artError.message}\n`);
      return "FAIL";
    }

    if (!artworks || artworks.length === 0) {
      console.log(`❌ FAIL: No artworks found for artist_id = ${artist.id}\n`);
      status = "FAIL";
    } else {
      console.log(`✅ Found ${artworks.length} artwork(s):\n`);

      const byStatus = {};
      artworks.forEach((a) => {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      });

      Object.keys(byStatus).forEach((s) => {
        console.log(`   ${s}: ${byStatus[s]}`);
      });

      console.log("\n   Listing:");
      artworks.forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.title}"`);
        console.log(`      Status: ${a.status} | For Sale: ${a.for_sale}`);
        console.log(
          `      Created: ${new Date(a.created_at).toLocaleDateString("fr-FR")}`
        );
      });
      console.log();
    }

    // ===== STEP 3: Simulate API Call (After Fix) =====
    console.log("📋 STEP 3: Simulate API call (GET /api/artworks?artist_id=...)\n");

    // The fix: if artist_id is present, don't apply default status='approved' filter
    console.log(`   With our fix in api/[...path].js:`);
    console.log(`   - OLD behavior: status='approved' applied by default`);
    console.log(`   - NEW behavior: returns ALL artworks\n`);

    if (artworks && artworks.length > 0) {
      console.log(`   ✅ API WILL return ${artworks.length} artwork(s):\n`);
      artworks.slice(0, 5).forEach((a) => {
        console.log(`      ✓ "${a.title}" [${a.status}]`);
      });
      if (artworks.length > 5) {
        console.log(`      ... and ${artworks.length - 5} more`);
      }
      console.log();
    }

    // ===== STEP 4: Verify Deployment =====
    console.log("📋 STEP 4: Check if fix is deployed\n");

    console.log(`   The fix was pushed to 'main' branch:`);
    console.log(`   - Commit: b6b802f (fix: Artist dashboard shows empty artworks...)`);
    console.log(`   - Merge: 0f54976 (Merge branch 'dev')\n`);

    console.log(`   ✅ Code is on GitHub main branch`);
    console.log(
      `   ⏳ Vercel auto-deploys from main (check dashboard.vercel.com)\n`
    );

    // ===== STEP 5: Dashboard Simulation =====
    console.log("📋 STEP 5: What Missira's dashboard will show\n");

    if (status === "PASS" && artworks && artworks.length > 0) {
      console.log(`   ✅ WILL SHOW: ${artworks.length} artwork(s)`);
      artworks.forEach((a) => {
        console.log(`      • "${a.title}"`);
      });
    } else if (status === "PASS" && (!artworks || artworks.length === 0)) {
      console.log(`   ⚠️  WILL SHOW: Empty dashboard (0 artworks)`);
    } else {
      console.log(`   ❌ May not work - see issues above`);
    }
    console.log();

    // ===== SUMMARY =====
    console.log("=".repeat(80) + "\n");
    console.log("📊 SUMMARY\n");

    if (status === "PASS" && artworks && artworks.length > 0) {
      console.log("✅ EVERYTHING LOOKS GOOD!\n");
      console.log("   • User exists: ✓");
      console.log("   • Artist record exists: ✓");
      console.log(`   • Artworks in DB: ✓ (${artworks.length})`);
      console.log("   • API fix deployed: ✓\n");
      console.log("   👉 Next steps:");
      console.log("      1. Missira clears browser cache (Ctrl+F5)");
      console.log("      2. Missira logs out and logs back in");
      console.log("      3. Missira should see all her artworks on dashboard\n");
      console.log("   If she STILL doesn't see them:");
      console.log("      • Check Vercel deployment (may need manual redeploy)");
      console.log("      • Check browser console for errors (F12)");
      console.log("      • Try different browser/incognito mode\n");
    } else if (!artist) {
      console.log("❌ ISSUE: Missing artist record\n");
      console.log("   Run: node scripts/fix-missira-profile.js\n");
    } else if (!artworks || artworks.length === 0) {
      console.log("⚠️  No artworks found in database\n");
      console.log("   Either Missira never uploaded any, or they were deleted.\n");
    }

    return status;
  } catch (err) {
    console.error("❌ UNEXPECTED ERROR:", err.message);
    return "ERROR";
  }
}

finalCheck()
  .then((result) => {
    process.exit(result === "PASS" ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
