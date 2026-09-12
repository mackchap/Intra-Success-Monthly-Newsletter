import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Uses the Edge-safe config only (see auth.config.ts) — this file runs in
// Next.js Middleware's Edge runtime, which can't load the Prisma adapter or
// bcrypt used by the full config in auth.ts.
const { auth } = NextAuth(authConfig);

const FUNNEL_SESSION_COOKIE = "fs_id";
const FUNNEL_SESSION_HEADER = "x-fs-id";

// Route-level RBAC. Page/API-level checks still apply for defense in depth —
// this only keeps unauthenticated/under-privileged users out of whole sections.
export default auth((req) => {
  const { nextUrl } = req;
  const role = req.auth?.user?.role;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isStaffRoute = nextUrl.pathname.startsWith("/staff");
  const isPortalRoute = nextUrl.pathname.startsWith("/portal");
  const isFunnelRoute = nextUrl.pathname.startsWith("/f/");

  const loginUrl = new URL("/login", nextUrl);

  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(loginUrl);
  }

  if (isStaffRoute && role !== "ADMIN" && role !== "STAFF") {
    return NextResponse.redirect(loginUrl);
  }

  if (isPortalRoute && !req.auth) {
    return NextResponse.redirect(loginUrl);
  }

  if (isFunnelRoute) {
    // Anonymous per-visitor session id, for FunnelVisit analytics. Forwarded
    // via a request header (not just the response cookie) because a cookie
    // set here isn't visible to this same request's Server Component render
    // — Set-Cookie only takes effect on the browser's *next* request.
    const existing = req.cookies.get(FUNNEL_SESSION_COOKIE)?.value;
    const sessionId = existing ?? crypto.randomUUID();

    const forwardedHeaders = new Headers(req.headers);
    forwardedHeaders.set(FUNNEL_SESSION_HEADER, sessionId);
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    if (!existing) {
      response.cookies.set(FUNNEL_SESSION_COOKIE, sessionId, {
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
      });
    }
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/portal/:path*", "/f/:path*"],
};
