import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Uses the Edge-safe config only (see auth.config.ts) — this file runs in
// Next.js Middleware's Edge runtime, which can't load the Prisma adapter or
// bcrypt used by the full config in auth.ts.
const { auth } = NextAuth(authConfig);

// Route-level RBAC. Page/API-level checks still apply for defense in depth —
// this only keeps unauthenticated/under-privileged users out of whole sections.
export default auth((req) => {
  const { nextUrl } = req;
  const role = req.auth?.user?.role;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isStaffRoute = nextUrl.pathname.startsWith("/staff");
  const isPortalRoute = nextUrl.pathname.startsWith("/portal");

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

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/portal/:path*"],
};
