import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const uploadNotes = formData.get("uploadNotes") as string;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    const lastDotIndex = file.name.lastIndexOf(".");
    const baseName = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
    const extension = lastDotIndex > 0 ? file.name.substring(lastDotIndex) : "";

    const sanitizedBaseName = baseName
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s/g, "-");

    const sanitizedFileName = sanitizedBaseName + extension;
    const fileName = `company/${Date.now()}-${sanitizedFileName}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("company-documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: fileData, error: dbError } = await supabase
      .from("company_documents")
      .insert({
        file_name: file.name,
        file_size: file.size,
        file_mime_type: file.type,
        file_path: fileName,
        file_uploaded_at: new Date().toISOString(),
        upload_notes: uploadNotes || null,
        created_by_user_id: session.user.id,
      })
      .select("*")
      .single();

    if (dbError) {
      await supabase.storage.from("company-documents").remove([fileName]);
      return NextResponse.json(
        { error: `Failed to create file record: ${dbError.message}` },
        { status: 500 }
      );
    }

    const { data: signedUrl, error: signError } = await supabase.storage
      .from("company-documents")
      .createSignedUrl(fileData.file_path, 24 * 60 * 60);

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...fileData,
          signedUrl: signError ? null : signedUrl?.signedUrl,
          signError: signError?.message || null,
        },
        message: "Company document uploaded",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Upload company document error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session: any = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();

    const { data: files, error } = await supabase
      .from("company_documents")
      .select("*")
      .order("file_uploaded_at", { ascending: false });

    if (error) throw error;

    const filesWithSignedUrls = await Promise.all(
      (files || []).map(async (file) => {
        const { data: signedUrl, error: signError } = await supabase.storage
          .from("company-documents")
          .createSignedUrl(file.file_path, 24 * 60 * 60);

        return {
          ...file,
          signedUrl: signError ? null : signedUrl?.signedUrl,
          signError: signError?.message || null,
        };
      })
    );

    return NextResponse.json({ ok: true, data: filesWithSignedUrls });
  } catch (error: any) {
    console.error("Fetch company documents error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch" },
      { status: 500 }
    );
  }
}
