import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get user session for authenticated access
    const session: any = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const path = req.nextUrl.searchParams.get("path");
    if (!path) {
      return NextResponse.json(
        { error: "Missing path parameter" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase.storage
      .from("chinese-po-files")
      .download(path);

    if (error) {
      return NextResponse.json(
        { error: `Download failed: ${error.message}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    const fileName = path.split("/").pop() || "file";

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": data.type,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Download file error:", error);
    return NextResponse.json(
      { error: error.message || "Download failed" },
      { status: 500 }
    );
  }
}
