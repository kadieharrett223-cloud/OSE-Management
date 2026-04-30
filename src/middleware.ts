import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const SIGN_IN_PATH = "/auth/signin";
const AUTH_SECRET = process.env.NEXTAUTH_SECRET || "development-secret-do-not-use-in-production";
const ACCESS_COOKIE = "app_access_expires";

function hasSharedAccess(req: NextRequest) {
  const raw = req.cookies.get(ACCESS_COOKIE)?.value;
  const expiresAt = Number(raw || 0);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isPublicPath =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/auth/");

  if (isPublicPath) {
    return NextResponse.next();
  }

  if (hasSharedAccess(req)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: AUTH_SECRET });
  if (token) {
    return NextResponse.next();
  }

  const signInUrl = req.nextUrl.clone();
  signInUrl.pathname = SIGN_IN_PATH;
  signInUrl.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!api/|auth/signin|auth/signup|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
