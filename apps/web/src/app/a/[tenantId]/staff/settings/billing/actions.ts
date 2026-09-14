"use server";

import { redirect } from "next/navigation";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { createPlatformCheckoutSession } from "@/lib/billing/platform-subscription";
import { str } from "@/lib/form-data";

export async function subscribeToPlatformAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { session } = await requireAccountRole(tenantId, "OWNER");

  const url = await createPlatformCheckoutSession(tenantId, session.user.email ?? "");
  redirect(url);
}
