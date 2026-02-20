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

async function testFile(filePath) {
  console.log(`\n🧪 Testing: ${filePath}`);

  try {
    const { data, error } = await supabase.storage
      .from("chinese-po-files")
      .download(filePath);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return false;
    }

    if (data) {
      console.log(`   ✅ File exists! Size: ${data.size} bytes`);
      return true;
    }

    console.log(`   ❌ No data returned`);
    return false;
  } catch (err) {
    console.log(`   ❌ Exception: ${err.message}`);
    return false;
  }
}

async function main() {
  const filePaths = [
    "3257d9b5-a36a-46c9-9e1f-a571805ec90b/1771606941316-Invoice-PO225.pdf",
    "82a55e45-1545-4fc3-81e6-9015af64d146/1771606972197-Invoice-PO226.pdf",
  ];

  console.log("🔎 Testing if files exist in storage...");

  for (const filePath of filePaths) {
    await testFile(filePath);
  }
}

main().catch(console.error);
