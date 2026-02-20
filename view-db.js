#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from("chinese_po_files")
    .select("id, purchase_order_id, file_name, file_path")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("\n📋 Current database content:\n");

  data.forEach((row) => {
    console.log(`PO ID: ${row.purchase_order_id}`);
    console.log(`  file_name: "${row.file_name}"`);
    console.log(`  file_path: "${row.file_path}"`);
    console.log(`  hex file_path: ${Buffer.from(row.file_path).toString('hex')}`);
    console.log();
  });
}

main().catch(console.error);
