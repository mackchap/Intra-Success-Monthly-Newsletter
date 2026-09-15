"use server";

import { redirect } from "next/navigation";
import { createBillingPortalSession } from "@/lib/billing/portal";
import { requireSession } from "@/lib/require-auth";
import { str } from "@/lib/form-data";

// A portal user can have purchases from more than one tenant (Phase 9) —
// "manage billing" is now per-tenant, since each tenant's payments live on
// that tenant's own connected Stripe account.
export async function manageBillingAction(formData: FormData) {
  const session = await requireSession();
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");

  const url = await createBillingPortalSession(tenantId, session.user.id);
  redirect(url);
}
