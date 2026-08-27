#!/usr/bin/env node

/**
 * CHECK: users table schema and constraints
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

async function check() {
  console.log("🔍 CHECKING users TABLE SCHEMA...\n");

  try {
    // Get table schema via information_schema
    const { data, error } = await supabaseAdmin.rpc('get_table_columns', {
      table_name: 'users',
    }).catch(() => {
      console.log("RPC not available, trying direct query\n");
      return { data: null, error: true };
    });

    if (error || !data) {
      console.log("Trying to insert a test record to see the actual error...\n");

      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: '00000000-0000-0000-0000-000000000000',
          role: 'artist',
          name: 'Test',
        });

      if (insertError) {
        console.log(`Insert error: ${insertError.message}`);
        console.log(`Error code: ${insertError.code}`);
        console.log(`Error details:`, insertError);
      }
      return;
    }

    console.log("Users table columns:");
    data.forEach((col) => {
      console.log(`  - ${col.name}: ${col.type} ${col.is_nullable ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

check();
