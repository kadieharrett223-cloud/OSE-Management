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
  console.log("🔍 Checking database vs storage...\n");

  // Get all chinese_po_files records
  const { data: dbFiles, error } = await supabase
    .from("chinese_po_files")
    .select("id, file_name, file_path")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching from DB:", error.message);
    return;
  }

  console.log("📋 Database records:");
  dbFiles.forEach((f) => {
    console.log(`  - ${f.file_path} (${f.file_name})`);
  });

  console.log("\n💾 Files in storage:");
  const { data: storageFiles } = await supabase.storage
    .from("chinese-po-files")
    .list("", { recursive: true });

  if (storageFiles) {
    storageFiles.forEach((f) => {
      console.log(`  - ${f.name}`);
    });
  }

  console.log("\n🔗 Checking if paths match:");
  dbFiles.forEach((dbFile) => {
    const exists = storageFiles?.some((sf) => sf.name === dbFile.file_path);
    const status = exists ? "✅" : "❌";
    console.log(`${status} ${dbFile.file_path}`);
  });
}

main().catch(console.error);
