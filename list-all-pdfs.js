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

async function listFilesRecursive(bucketName, prefix = "") {
  const { data: items, error } = await supabase.storage
    .from(bucketName)
    .list(prefix, { limit: 1000 });

  if (error) {
    console.error(`Error listing ${prefix}: ${error.message}`);
    return [];
  }

  let allFiles = [];

  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.metadata?.mimetype === "application/pdf") {
      // It's a file
      allFiles.push(fullPath);
    } else if (!item.name.includes(".")) {
      // It might be a directory, try listing it
      const subFiles = await listFilesRecursive(bucketName, fullPath);
      allFiles = allFiles.concat(subFiles);
    }
  }

  return allFiles;
}

async function main() {
  console.log("📁 All PDF files in chinese-po-files bucket:\n");

  const files = await listFilesRecursive("chinese-po-files");

  if (files.length === 0) {
    console.log("❌ No files found!");
  } else {
    files.forEach((f) => {
      console.log(`  ✅ ${f}`);
    });
  }

  console.log(`\nTotal: ${files.length} files`);
}

main().catch(console.error);
