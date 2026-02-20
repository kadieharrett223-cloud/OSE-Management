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

async function fixTrailingDashes() {
  console.log("🚀 Fixing files with trailing dashes...\n");

  const filesToFix = [
    {
      bucket: "chinese-po-files",
      oldPath:
        "3257d9b5-a36a-46c9-9e1f-a571805ec90b/1771606941316-Invoice-PO225-.pdf",
      newPath:
        "3257d9b5-a36a-46c9-9e1f-a571805ec90b/1771606941316-Invoice-PO225.pdf",
      table: "chinese_po_files",
      column: "file_path",
    },
    {
      bucket: "chinese-po-files",
      oldPath:
        "82a55e45-1545-4fc3-81e6-9015af64d146/1771606972197-Invoice-PO226-.pdf",
      newPath:
        "82a55e45-1545-4fc3-81e6-9015af64d146/1771606972197-Invoice-PO226.pdf",
      table: "chinese_po_files",
      column: "file_path",
    },
  ];

  for (const file of filesToFix) {
    console.log(`🔄 Processing: ${file.oldPath}`);

    try {
      // Download original file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(file.bucket)
        .download(file.oldPath);

      if (downloadError) {
        console.error(`   ❌ Download failed: ${downloadError.message}`);
        continue;
      }

      // Upload to new path
      const { error: uploadError } = await supabase.storage
        .from(file.bucket)
        .upload(file.newPath, fileData, { upsert: false });

      if (uploadError) {
        console.error(`   ❌ Upload failed: ${uploadError.message}`);
        continue;
      }

      // Update database record
      const { error: updateError } = await supabase
        .from(file.table)
        .update({ [file.column]: file.newPath })
        .eq(file.column, file.oldPath);

      if (updateError) {
        console.error(
          `   ⚠️  Database update failed: ${updateError.message}`
        );
        continue;
      }

      // Delete original file
      const { error: deleteError } = await supabase.storage
        .from(file.bucket)
        .remove([file.oldPath]);

      if (deleteError) {
        console.error(`   ⚠️  Delete failed: ${deleteError.message}`);
      } else {
        console.log(`   ✅ Fixed: ${file.newPath}\n`);
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log("✨ Done!");
}

fixTrailingDashes().catch(console.error);
