import { NextResponse } from "next/server";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { syncConnectAccountStatus } from "@/lib/billing/connect";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.redirect(new URL("/accounts", request.url));
  }

  await requireAccountRole(tenantId, "OWNER");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (tenant?.stripeConnectAccountId) {
    // Best-effort refresh — Stripe's own account.updated webhook (handled in
    // webhook-handlers.ts) is the authoritative source once Connect webhooks
    // are configured; this just avoids a stale status until that event lands.
    await syncConnectAccountStatus(tenant.stripeConnectAccountId).catch((error) =>
      console.warn(`Failed to sync Connect status for tenant ${tenantId}:`, error),
    );
  }

  return NextResponse.redirect(new URL(`/a/${tenantId}/staff/settings/billing`, request.url));
}
