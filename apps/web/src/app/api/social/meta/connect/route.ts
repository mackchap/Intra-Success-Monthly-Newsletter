import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireStaffSession } from "@/lib/require-staff";

export const dynamic = "force-dynamic";

// pages_manage_posts + instagram_content_publish are the two permissions
// that actually let us publish; the rest are read scopes Meta requires
// alongside them to resolve the Page -> linked Instagram Business account.
const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
];

export async function GET(request: Request) {
  await requireStaffSession();

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "META_APP_ID is not configured." }, { status: 500 });
  }

  const redirectUri = new URL("/api/social/meta/callback", request.url).toString();
  const state = randomBytes(16).toString("hex");

  const authorizeUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", META_OAUTH_SCOPES.join(","));

  // Double-submit cookie: the callback checks this against Meta's returned
  // `state` to rule out a forged redirect (standard OAuth CSRF protection).
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
