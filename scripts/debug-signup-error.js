#!/usr/bin/env node

/**
 * DEBUG: Test signup via the actual API endpoint
 * This will show us the exact error
 */

const fetch = require("node-fetch");

const API_URL = process.env.API_URL || "http://localhost:3000";
const API_KEY = process.env.API_KEY;

async function test() {
  console.log("🧪 TESTING SIGNUP VIA API...\n");

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";

  console.log(`Testing with:`);
  console.log(`  Email: ${testEmail}`);
  console.log(`  Password: [hidden]\n`);

  try {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "kcb-api-key": API_KEY,
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        role: "artist",
        name: "Test Artist",
      }),
    });

    const body = await response.json();

    console.log(`Response status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(body, null, 2));

    if (!response.ok) {
      console.log("\n❌ Signup failed!");
      console.log(`Error: ${body.error}`);
    } else {
      console.log("\n✅ Signup succeeded!");
      console.log(`User ID: ${body.data.user.id}`);
    }
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

test();
