#!/usr/bin/env node

/**
 * Load .env.production.local and run final-check-missira.js
 */

const fs = require("fs");
const path = require("path");

// Load .env.production.local
const envPath = path.join(__dirname, "../.env.production.local");

if (!fs.existsSync(envPath)) {
  console.error("❌ .env.production.local not found");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const lines = envContent.split("\n");

lines.forEach((line) => {
  if (!line.trim() || line.startsWith("#")) return;

  const [key, ...rest] = line.split("=");
  let value = rest.join("=").trim();

  // Remove quotes
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }

  process.env[key.trim()] = value;
});

// Now run the actual script
require("./final-check-missira.js");
