import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight middleware that only checks for the session cookie.
 *
 * We intentionally avoid running the full NextAuth auth() flow here because
 * Next.js 16 does not allow cookies to be modified in middleware. When a
 * Strava token needs refreshing, the JWT callback updates the session cookie,
 * which crashes in middleware context. The full auth + token refresh runs in
 * the (app)/layout.tsx Server Component instead, where cookies CAN be modified.
 */
export function middleware(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/groups/:path*",
    "/rides/:path*",
    "/profile/:path*",
  ],
};
