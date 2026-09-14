import { NextResponse } from "next/server";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { createConnectOnboardingLink } from "@/lib/billing/connect";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
  }

  // Connecting a Stripe account is a business-critical, money-moving action
  // — only the Tenant's OWNER can start it, not any STAFF member.
  await requireAccountRole(tenantId, "OWNER");

  const url = await createConnectOnboardingLink(tenantId);
  return NextResponse.redirect(url);
}
