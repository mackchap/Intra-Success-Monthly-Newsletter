import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { connectMetaAccounts } from "@/lib/social/connect";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_oauth_state")?.value;
  const tenantId = cookieStore.get("meta_oauth_tenant")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !tenantId) {
    const response = NextResponse.redirect(new URL(tenantId ? `/a/${tenantId}/admin/marketing?error=invalid_state` : "/accounts", request.url));
    response.cookies.delete("meta_oauth_state");
    response.cookies.delete("meta_oauth_tenant");
    return response;
  }

  // Re-verify (the connect route already checked this before starting the
  // OAuth dance) — the requesting admin's membership could have changed in
  // the time it took to complete Meta's OAuth dialog.
  const { session } = await requireAccountRole(tenantId, "ADMIN");

  const redirectUri = new URL("/api/social/meta/callback", request.url).toString();

  let connectedPages = 0;
  try {
    const result = await connectMetaAccounts({ tenantId, code, redirectUri, connectedByUserId: session.user.id });
    connectedPages = result.connectedPages;
  } catch (error) {
    console.error("Failed to connect Meta accounts:", error);
    const response = NextResponse.redirect(new URL(`/a/${tenantId}/admin/marketing?error=connect_failed`, request.url));
    response.cookies.delete("meta_oauth_state");
    response.cookies.delete("meta_oauth_tenant");
    return response;
  }

  const response = NextResponse.redirect(new URL(`/a/${tenantId}/admin/marketing?connected=${connectedPages}`, request.url));
  response.cookies.delete("meta_oauth_state");
  response.cookies.delete("meta_oauth_tenant");
  return response;
}
