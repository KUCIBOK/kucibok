#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getColumns() {
  console.log("Getting users table columns...\n");

  // Try to insert with no columns to see what columns are required
  // Actually, let's just query the schema via a test insert

  // Get the first user to see what columns exist
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('*')
    .limit(1);

  if (users && users.length > 0) {
    const firstUser = users[0];
    console.log("✅ Columns in users table:\n");
    Object.keys(firstUser).forEach((col) => {
      console.log(`  ✓ ${col}: ${typeof firstUser[col]}`);
    });
  }
}

getColumns().catch(e => console.error("Error:", e.message));
