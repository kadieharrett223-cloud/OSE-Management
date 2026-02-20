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

async function listBucketFiles(bucketName) {
  console.log(`\n📁 Files in ${bucketName}:\n`);

  // First list all directories/files at root
  const { data: root, error: rootError } = await supabase.storage
    .from(bucketName)
    .list("");

  if (rootError) {
    console.error(`Error listing root: ${rootError.message}`);
    return;
  }

  let allFiles = [];

  for (const item of root) {
    if (item.name.includes(".")) {
      // It's a file
      allFiles.push(item.name);
    } else {
      // It's a directory, list its contents
      const { data: subFiles, error: subError } = await supabase.storage
        .from(bucketName)
        .list(item.name, { recursive: true });

      if (subError) {
        console.error(`Error listing ${item.name}: ${subError.message}`);
      } else {
        subFiles.forEach((f) => {
          allFiles.push(`${item.name}/${f.name}`);
        });
      }
    }
  }

  allFiles.forEach((file) => {
    const hasSpaces = file.includes(" ");
    const marker = hasSpaces ? "⚠️ " : "✅";
    console.log(`${marker} ${file}`);
  });

  const withSpaces = allFiles.filter((f) => f.includes(" "));
  console.log(
    `\nTotal: ${allFiles.length} files, ${withSpaces.length} with spaces`
  );

  return allFiles;
}

async function main() {
  await listBucketFiles("chinese-invoices");
  await listBucketFiles("chinese-po-files");
}

main().catch(console.error);
