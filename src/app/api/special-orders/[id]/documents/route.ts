import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("special_order_documents")
      .select("id, created_at, file_name, file_size, file_mime_type, file_path, upload_notes")
      .eq("special_order_id", params.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const withUrls = await Promise.all(
      (data || []).map(async (doc: any) => {
        const { data: signed, error: signError } = await supabase.storage
          .from("special-order-documents")
          .createSignedUrl(doc.file_path, 24 * 60 * 60);

        return {
          ...doc,
          signedUrl: signError ? null : signed?.signedUrl,
        };
      })
    );

    return NextResponse.json({ ok: true, data: withUrls });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const uploadNotes = (formData.get("uploadNotes") || "").toString();

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    const extIndex = file.name.lastIndexOf(".");
    const baseName = extIndex > 0 ? file.name.slice(0, extIndex) : file.name;
    const ext = extIndex > 0 ? file.name.slice(extIndex) : "";
    const sanitized = baseName.replace(/\s+/g, " ").trim().replace(/\s/g, "-");

    const filePath = `special-orders/${params.id}/${Date.now()}-${sanitized}${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("special-order-documents")
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await supabase
      .from("special_order_documents")
      .insert({
        special_order_id: params.id,
        file_name: file.name,
        file_size: file.size,
        file_mime_type: file.type,
        file_path: filePath,
        upload_notes: uploadNotes || null,
        created_by: session.user.email || session.user.id || "Unknown",
      })
      .select("id, created_at, file_name, file_size, file_mime_type, file_path, upload_notes")
      .single();

    if (error) {
      await supabase.storage.from("special-order-documents").remove([filePath]);
      throw error;
    }

    const { data: signed } = await supabase.storage
      .from("special-order-documents")
      .createSignedUrl(data.file_path, 24 * 60 * 60);

    return NextResponse.json({ ok: true, data: { ...data, signedUrl: signed?.signedUrl || null } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to upload document" }, { status: 500 });
  }
}