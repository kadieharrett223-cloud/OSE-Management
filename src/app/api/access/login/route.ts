import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "app_access_expires";

function getNextMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const submittedPassword = (body?.password ?? "").toString();
    const sharedPassword = process.env.APP_SHARED_PASSWORD;

    if (!sharedPassword) {
      return NextResponse.json(
        { error: "APP_SHARED_PASSWORD is not configured." },
        { status: 500 }
      );
    }

    if (!submittedPassword || submittedPassword !== sharedPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const callbackUrl = (body?.callbackUrl ?? "/").toString();
    const nextMidnight = getNextMidnight();

    const response = NextResponse.json({ ok: true, callbackUrl });
    response.cookies.set({
      name: ACCESS_COOKIE,
      value: String(nextMidnight.getTime()),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: nextMidnight,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to log in" },
      { status: 500 }
    );
  }
}
