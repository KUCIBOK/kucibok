#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function addPassword() {
  const MISSIRA_ID = "adcff51e-d77a-46eb-9e88-9ae06ce8832d";
  const MISSIRA_EMAIL = "misirakeita@gmail.com";
  const NEW_PASSWORD = "ManouAdele130414*";

  console.log(`🔐 ADDING PASSWORD TO MISSIRA'S ACCOUNT\n`);
  console.log("=".repeat(70) + "\n");

  try {
    console.log(`Email: ${MISSIRA_EMAIL}`);
    console.log(`Password: [${NEW_PASSWORD.length} characters]\n`);

    console.log("Updating password...\n");

    const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      MISSIRA_ID,
      { password: NEW_PASSWORD }
    );

    if (updateError) {
      console.log(`❌ Error: ${updateError.message}\n`);
      return;
    }

    console.log(`✅ Password added successfully!\n`);

    console.log("=".repeat(70) + "\n");
    console.log("✅ MISSIRA CAN NOW LOGIN WITH:\n");
    console.log(`   Email: ${MISSIRA_EMAIL}`);
    console.log(`   Password: ManouAdele130414*\n`);

    console.log("She can login at:");
    console.log(`   https://kucibok-wine.vercel.app/sign-in\n`);

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

addPassword();
