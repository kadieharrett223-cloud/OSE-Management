import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/qbo";

export async function GET() {
  try {
    const state = "ose-qbo"; // TODO: replace with CSRF-safe state if needed
    const url = buildAuthorizeUrl(state);
    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error("QBO connect error", error);
    return NextResponse.json({ error: error.message || "Failed to start QBO auth" }, { status: 500 });
  }
}
