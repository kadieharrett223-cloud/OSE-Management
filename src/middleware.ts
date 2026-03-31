import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/|auth/signin|auth/signup|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
