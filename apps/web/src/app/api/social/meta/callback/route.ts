import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireStaffSession } from "@/lib/require-staff";
import { connectMetaAccounts } from "@/lib/social/connect";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireStaffSession();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/admin/marketing?error=invalid_state", request.url));
  }

  const redirectUri = new URL("/api/social/meta/callback", request.url).toString();

  let connectedPages = 0;
  try {
    const result = await connectMetaAccounts({ code, redirectUri, connectedByUserId: session.user.id });
    connectedPages = result.connectedPages;
  } catch (error) {
    console.error("Failed to connect Meta accounts:", error);
    const response = NextResponse.redirect(new URL("/admin/marketing?error=connect_failed", request.url));
    response.cookies.delete("meta_oauth_state");
    return response;
  }

  const response = NextResponse.redirect(new URL(`/admin/marketing?connected=${connectedPages}`, request.url));
  response.cookies.delete("meta_oauth_state");
  return response;
}
