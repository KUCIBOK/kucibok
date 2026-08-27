#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
const SUPABASE_URL = "https://wyrmpddlhldjzoiwbshj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cm1wZGRsaGxkanpvaXdic2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwNjA0NywiZXhwIjoyMDg4MjgyMDQ3fQ.QQ6Bt-Tk5Vm_Lp8zD1SewXFgPRHGZgvA2v6zj87ijqs";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const DIOMAN_USER_ID = "c670d119-3b34-4dad-a797-84e3f722da07";
  const artwork_id = "90d97764-471c-47c7-ae97-fd2996d7cb7e";
  
  const { error } = await supabase
    .from("artworks")
    .update({ user_id: DIOMAN_USER_ID })
    .eq("id", artwork_id);
  
  if (error) {
    console.log("❌ Failed:", error.message);
  } else {
    console.log("✅ Fixed GUERRIER artwork!");
  }
}

fix();
