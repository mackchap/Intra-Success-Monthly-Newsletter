"use server";

import { redirect } from "next/navigation";
import { createBillingPortalSession } from "@/lib/billing/portal";
import { requireSession } from "@/lib/require-auth";

export async function manageBillingAction() {
  const session = await requireSession();
  const url = await createBillingPortalSession(session.user.id);
  redirect(url);
}
