import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Query for the "Undeposited Funds" account
    // This is the actual source of truth for undeposited funds in QBO
    const query = "SELECT * FROM Account WHERE Name = 'Undeposited Funds'";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`,
      {},
      userId || undefined
    );

    const accounts = data?.QueryResponse?.Account || [];
    const undepositedAccount = accounts[0];

    // Get the current balance of the Undeposited Funds account
    const undeposited = undepositedAccount ? Number(undepositedAccount.CurrentBalance || 0) : 0;

    return NextResponse.json({
      ok: true,
      account: undepositedAccount,
      undeposited,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to query undeposited funds" },
      { status: 500 }
    );
  }
}
