#!/usr/bin/env node
/**
 * Script to sanitize existing file names in Supabase storage
 * Replaces spaces with dashes in chinese-invoices and chinese-po-files buckets
 */

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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function sanitizeFileName(fileName) {
  // Handle filename and extension separately
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";

  const sanitizedBaseName = baseName
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .replace(/\s/g, "-"); // Replace remaining spaces with dashes

  return sanitizedBaseName + extension;
}

async function fixFilesInBucket(bucketName, tableName, filePathColumn) {
  console.log(`\n📁 Processing bucket: ${bucketName}`);

  try {
    // List root directories/files
    const { data: root, error: rootError } = await supabase.storage
      .from(bucketName)
      .list("");

    if (rootError) {
      console.error(`❌ Error listing root: ${rootError.message}`);
      return;
    }

    let allFiles = [];

    // Get files from root and subdirectories
    for (const item of root) {
      if (item.name.includes(".")) {
        allFiles.push(item.name);
      } else {
        const { data: subFiles, error: subError } = await supabase.storage
          .from(bucketName)
          .list(item.name, { recursive: true });

        if (subError) {
          console.error(`❌ Error listing ${item.name}: ${subError.message}`);
        } else {
          subFiles.forEach((f) => {
            allFiles.push(`${item.name}/${f.name}`);
          });
        }
      }
    }

    console.log(`Found ${allFiles.length} files`);

    let fixed = 0;
    let skipped = 0;

    for (const originalPath of allFiles) {
      // Check if filename has spaces
      if (!originalPath.includes(" ")) {
        skipped++;
        continue;
      }

      console.log(`\n🔄 Processing: ${originalPath}`);

      // Sanitize the filename
      const fileName = originalPath.split("/").pop();
      const dirPath = originalPath.substring(0, originalPath.lastIndexOf("/"));
      const sanitizedFileName = await sanitizeFileName(fileName);
      const newPath = dirPath ? `${dirPath}/${sanitizedFileName}` : sanitizedFileName;

      console.log(`   New name: ${newPath}`);

      try {
        // Download original file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucketName)
          .download(originalPath);

        if (downloadError) {
          console.error(`   ❌ Download failed: ${downloadError.message}`);
          continue;
        }

        // Upload to new path
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(newPath, fileData, { upsert: false });

        if (uploadError) {
          console.error(`   ❌ Upload failed: ${uploadError.message}`);
          continue;
        }

        // Update database record
        if (tableName && filePathColumn) {
          const { error: updateError } = await supabase
            .from(tableName)
            .update({ [filePathColumn]: newPath })
            .eq(filePathColumn, originalPath);

          if (updateError) {
            console.error(
              `   ⚠️  Database update failed: ${updateError.message}`
            );
            // Don't delete if DB update fails
            continue;
          }
        }

        // Delete original file
        const { error: deleteError } = await supabase.storage
          .from(bucketName)
          .remove([originalPath]);

        if (deleteError) {
          console.error(`   ⚠️  Delete failed: ${deleteError.message}`);
        } else {
          console.log(`   ✅ Fixed!`);
          fixed++;
        }
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
      }
    }

    console.log(
      `\n✅ Bucket ${bucketName}: Fixed ${fixed}, Skipped ${skipped}`
    );
  } catch (err) {
    console.error(`❌ Error processing bucket ${bucketName}: ${err.message}`);
  }
}

async function main() {
  console.log("🚀 Starting filename sanitization...\n");

  // Fix chinese-invoices bucket
  await fixFilesInBucket(
    "chinese-invoices",
    "chinese_invoices",
    "invoice_file_path"
  );

  // Fix chinese-po-files bucket
  await fixFilesInBucket("chinese-po-files", "chinese_po_files", "file_path");

  console.log("\n✨ Done!");
}

main().catch(console.error);
