import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabaseClient();

    // Get all China POs without generated PDFs
    const { data: pos, error } = await supabase
      .from("purchase_orders")
      .select("id, po_number, generated_pdf_path, is_china_supplier")
      .eq("is_china_supplier", true)
      .is("generated_pdf_path", null);

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch POs: ${error.message}` },
        { status: 500 }
      );
    }

    if (!pos || pos.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No China POs need PDF generation",
        data: { generated: 0, total: 0 },
      });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Generate PDFs for each PO
    for (const po of pos) {
      try {
        const generateRes = await fetch(
          `${req.nextUrl.origin}/api/purchase-orders/${po.id}/generate-pdf`,
          { method: "POST" }
        );

        if (generateRes.ok) {
          successCount++;
          results.push({
            po_number: po.po_number,
            status: "success",
          });
        } else {
          failCount++;
          results.push({
            po_number: po.po_number,
            status: "failed",
            error: await generateRes.text(),
          });
        }
      } catch (err: any) {
        failCount++;
        results.push({
          po_number: po.po_number,
          status: "failed",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Generated ${successCount} PDFs, ${failCount} failed`,
      data: {
        total: pos.length,
        generated: successCount,
        failed: failCount,
        results,
      },
    });
  } catch (error: any) {
    console.error("Batch PDF generation error:", error);
    return NextResponse.json(
      { error: error.message || "Batch generation failed" },
      { status: 500 }
    );
  }
}
