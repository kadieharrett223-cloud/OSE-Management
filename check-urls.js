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
  console.log("🔐 Checking bucket policies...\n");

  // Get public URLs for files
  const files = [
    "3257d9b5-a36a-46c9-9e1f-a571805ec90b/1771606941316-Invoice-PO225.pdf",
    "82a55e45-1545-4fc3-81e6-9015af64d146/1771606972197-Invoice-PO226.pdf",
  ];

  files.forEach((filePath) => {
    const { data } = supabase.storage
      .from("chinese-po-files")
      .getPublicUrl(filePath);

    console.log(`✅ ${filePath}`);
    console.log(`   URL: ${data.publicUrl}\n`);
  });

  // Also try to get signed URLs with long expiry
  console.log("📝 Generating signed URLs (24 hours)...\n");
  for (const filePath of files) {
    const { data, error } = await supabase.storage
      .from("chinese-po-files")
      .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours

    if (error) {
      console.log(`❌ ${filePath}: ${error.message}`);
    } else {
      console.log(`✅ ${filePath}`);
      console.log(`   Signed URL: ${data.signedUrl}\n`);
    }
  }
}

main().catch(console.error);
