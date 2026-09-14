"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCompany } from "@/lib/crm/companies";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { str } from "@/lib/form-data";

export async function createCompanyAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "STAFF");

  const name = formData.get("name");
  if (typeof name !== "string" || !name) {
    throw new Error("Company name is required.");
  }

  const domain = formData.get("domain");
  const industry = formData.get("industry");
  const website = formData.get("website");

  const company = await createCompany({
    tenantId,
    name,
    domain: typeof domain === "string" && domain ? domain : undefined,
    industry: typeof industry === "string" && industry ? industry : undefined,
    website: typeof website === "string" && website ? website : undefined,
  });

  revalidatePath(`/a/${tenantId}/staff/companies`);
  redirect(`/a/${tenantId}/staff/companies/${company.id}`);
}
