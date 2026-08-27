#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function test() {
  console.log("Testing users table insert...\n");

  const testId = "11111111-1111-1111-1111-111111111111";

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      id: testId,
      role: 'artist',
      name: 'Test User',
      country: 'Senegal',
      telephone: null,
    });

  if (error) {
    console.log("❌ Insert failed:");
    console.log(`   Message: ${error.message}`);
    console.log(`   Code: ${error.code}`);
    console.log(`   Details:`, error.details);
    console.log(`\n   Trying to understand the error...`);

    if (error.message.includes('not found')) {
      console.log("   → Table or column doesn't exist");
    } else if (error.message.includes('permission')) {
      console.log("   → Permission denied (RLS?)");
    } else if (error.message.includes('violates')) {
      console.log("   → Constraint violation");
    }
  } else {
    console.log("✅ Insert successful!");
    console.log(`   Data:`, data);
  }
}

test().catch(e => console.error("Error:", e.message));
