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
  const isPlatformAdmin = req.auth?.user?.isPlatformAdmin ?? false;

  // Legacy, not-yet-tenant-scoped surfaces — shrinking each phase (Phase 9
  // moved Funnels/Academy/Marketing/Products/Sequences off this bare
  // `/admin` path onto `/a/[tenantId]/admin/*` below; whatever's still here
  // stays gated by isPlatformAdmin). See CLAUDE.md's Phase 8/9 sections.
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  // Tenant-scoped surfaces (CRM under /a/[tenantId]/staff, tenant admin
  // under /a/[tenantId]/admin). Middleware can only confirm *a* session
  // exists here — it can't reach Prisma from the Edge runtime to check
  // which Tenant(s) that session belongs to, so the real per-tenant
  // membership/role check happens in requireAccountRole() inside the
  // page/action itself (defense in depth, same split every other route
  // already uses).
  const isAccountRoute = nextUrl.pathname.startsWith("/a/");
  const isPlatformAdminRoute = nextUrl.pathname.startsWith("/platform-admin");
  const isPortalRoute = nextUrl.pathname.startsWith("/portal");
  // Public, tenant-scoped storefront pages (funnels today; courses/products
  // as Phase 9 lands them) — no auth, just the anonymous visit-session cookie.
  const isFunnelRoute = /^\/t\/[^/]+\/f\//.test(nextUrl.pathname);
  // Authenticated-only, not tenant-specific: the account switcher and the
  // "start a new business" onboarding flow.
  const isAccountsMetaRoute = nextUrl.pathname.startsWith("/accounts") || nextUrl.pathname.startsWith("/start");

  const loginUrl = new URL("/login", nextUrl);

  if (isAdminRoute && !isPlatformAdmin) {
    return NextResponse.redirect(loginUrl);
  }

  if (isPlatformAdminRoute && !isPlatformAdmin) {
    return NextResponse.redirect(loginUrl);
  }

  if ((isAccountRoute || isPortalRoute || isAccountsMetaRoute) && !req.auth) {
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
  matcher: [
    "/admin/:path*",
    "/a/:path*",
    "/platform-admin/:path*",
    "/portal/:path*",
    "/t/:path*",
    "/accounts/:path*",
    "/start/:path*",
  ],
};
