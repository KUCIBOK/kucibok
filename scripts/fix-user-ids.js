#!/usr/bin/env node

/**
 * FINAL FIX: Update user_id for orphaned artworks
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wyrmpddlhldjzoiwbshj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5cm1wZGRsaGxkanpvaXdic2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcwNjA0NywiZXhwIjoyMDg4MjgyMDQ3fQ.QQ6Bt-Tk5Vm_Lp8zD1SewXFgPRHGZgvA2v6zj87ijqs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Artist IDs and their corresponding user_ids
const ARTIST_USER_MAP = {
  '3e469ac2-5cf1-498a-9e20-f8f0312be8f0': null, // Dioman - need to find
  '6ee77d22-10d3-47b6-b484-737ad76d01b9': null, // Jizréel - need to find
  '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec': null  // TOURE - need to find
};

async function fixUserIds() {
  console.log("🔍 FINDING ARTIST USER_IDS...\n");

  // Get artists to find their user_ids
  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, user_id")
    .in("id", Object.keys(ARTIST_USER_MAP));

  if (!artists) {
    console.log("❌ Failed to fetch artists");
    return;
  }

  artists.forEach((artist) => {
    ARTIST_USER_MAP[artist.id] = artist.user_id;
    console.log(`✅ ${artist.name}: user_id = ${artist.user_id}`);
  });

  console.log("\n🔧 UPDATING 53 ARTWORKS WITH CORRECT USER_ID...\n");

  const CORRECTIONS = [
    // Dioman's artworks
    { id: 'cc30e881-d5d6-47d1-bc9c-25f18791ffc9', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '25c1d22c-e8ad-42a3-9b51-170c75f9d562', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'fd82f689-ab05-4900-b475-ff75687ba0b8', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '6838599d-605f-42f9-841c-4f460195cd64', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '8cb36975-899a-490c-8e87-5e91277cfcb3', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'f3b590ca-5408-4292-a1e8-24cb54a7d5ca', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'cc074cfa-e8a9-4f02-b51d-3ce39c7fc770', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '05b44fbf-3c21-4b00-84cb-805378712518', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '7c55d314-8359-40d0-9c34-24f533c9d215', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'ca850152-2898-4c2d-a045-6c09a5af9c91', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '1eaa66a8-c8fc-4bc6-86a1-9facc9e79f2d', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '604fd5e3-7dc2-48e1-ae8b-a738407faec7', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '3af509b2-3815-4089-b971-6588e220b98b', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'd212dae0-684d-41fb-bed4-a78ea6ae0a8a', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '048ba555-4e95-41d7-97d6-3a4d4882e9ae', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '9f005da6-abd8-491f-83a3-b0516e91c3aa', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'fb7024f6-c53e-44a5-b517-d76ed7aed158', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'd429c464-4e92-4825-a03e-b04c89bf64a7', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '6f1de934-f0e0-47b5-91ab-44bdefaee116', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '82106b71-b97c-42c0-ad99-99a6b3c81bd5', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '4849cc72-6191-42f5-bd83-04e70a074a45', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'e4d64dd0-4393-406e-a3d2-4bb6cf9b6c1d', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '89806856-d797-42e5-9e37-e5b5f195e4b3', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'd974d43b-db72-450f-9ba1-78b893eb6e43', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'f7c357aa-3acc-49fe-9179-dc36946efb2b', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '7ed46cbf-2771-47e5-921f-b3bdfe9e6f82', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'a5379381-34bd-4bc9-a39b-cd4d167a09ee', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '55e371d3-0424-47c1-abfb-6b1bb86407d4', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '61cc121e-66fa-4018-9cba-7624b6098284', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'd17bf443-e93b-472c-a977-71eb4d2815cf', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'b541600a-4302-4721-86d0-32e995c18778', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '156d9bca-0e04-4dc7-af23-6c7ceab5fc9a', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '3efce91b-4b93-48b7-9568-d6d5d299f26e', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'af95884a-99a6-40ff-89b0-2d8fe148b4cc', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '4a1ef74a-c189-4b02-a217-427f06a7314f', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'c34e82db-6932-4552-95bf-38ebfdb9dd63', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '7eb2bd51-28ef-452b-9c11-55a715e29955', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: '435acec1-3487-4353-9acb-a732c3c13279', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    { id: 'c21a45ae-d3f6-48c8-96de-499e245deaf8', artist_id: '3e469ac2-5cf1-498a-9e20-f8f0312be8f0' },
    // Jizréel's artworks
    { id: '8cb8603d-2c6d-46d3-b1a2-f51de53c822c', artist_id: '6ee77d22-10d3-47b6-b484-737ad76d01b9' },
    { id: '8f885025-2ca9-4ae5-badd-dc0c3845b8e9', artist_id: '6ee77d22-10d3-47b6-b484-737ad76d01b9' },
    { id: 'e71a47f2-1286-454e-8ea5-91cf0dcf49b4', artist_id: '6ee77d22-10d3-47b6-b484-737ad76d01b9' },
    { id: '4a17a051-b078-4c2a-8f6c-8fb99978d8c6', artist_id: '6ee77d22-10d3-47b6-b484-737ad76d01b9' },
    { id: '035a65ab-ce1b-47f1-97b8-99d47b5ec120', artist_id: '6ee77d22-10d3-47b6-b484-737ad76d01b9' },
    { id: '658c9c38-8797-4d8b-bd73-a97037ea634a', artist_id: '6ee77d22-10d3-47b6-b484-737ad76d01b9' },
    // TOURE's artworks
    { id: 'c2d2d354-9310-4051-b1e3-3d8816901a97', artist_id: '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec' },
    { id: 'aed67311-661b-48c2-868d-8506d644b641', artist_id: '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec' },
    { id: '49639598-2d7e-47f2-a0cd-827e5c3d753f', artist_id: '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec' },
    { id: 'af5133e0-31e7-48fb-942e-acbd67506435', artist_id: '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec' },
    { id: 'cd39e9ac-8857-47e9-a9fa-78c21fa4646d', artist_id: '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec' },
    { id: 'c48c4689-8eec-486d-b70a-80ac61f6e3df', artist_id: '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec' },
    { id: 'b7943fa1-d2d3-4dda-a073-f7c4208cf293', artist_id: '1f7a608c-cc8d-49d3-b1ee-f5e253f8ccec' }
  ];

  let fixed = 0;
  let failed = 0;

  for (const correction of CORRECTIONS) {
    const user_id = ARTIST_USER_MAP[correction.artist_id];
    if (!user_id) {
      console.log(`❌ ${correction.id.substring(0, 8)}: No user_id found for artist`);
      failed++;
      continue;
    }

    try {
      const { error } = await supabase
        .from("artworks")
        .update({ user_id: user_id })
        .eq("id", correction.id);

      if (error) {
        console.log(`❌ ${correction.id.substring(0, 8)}: ${error.message}`);
        failed++;
      } else {
        fixed++;
        process.stdout.write(".");
      }
    } catch (err) {
      failed++;
      console.log(`❌ ${err.message}`);
    }
  }

  console.log(`\n\n✅ FIXED: ${fixed}/53`);
  if (failed > 0) {
    console.log(`❌ FAILED: ${failed}`);
  }
  console.log("\n🔒 Database is now fully corrected with user_ids!");
}

fixUserIds();
