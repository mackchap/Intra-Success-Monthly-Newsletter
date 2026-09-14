"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/require-auth";
import { createTenantForUser } from "@/lib/accounts/tenants";
import { str } from "@/lib/form-data";

export async function createAccountAction(formData: FormData) {
  const session = await requireSession();

  const name = str(formData, "name");
  if (!name) throw new Error("Business name is required.");

  const tenant = await createTenantForUser({ userId: session.user.id, name });

  redirect(`/a/${tenant.id}/staff`);
}
