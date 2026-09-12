"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCompany } from "@/lib/crm/companies";
import { requireStaffSession } from "@/lib/require-staff";

export async function createCompanyAction(formData: FormData) {
  await requireStaffSession();

  const name = formData.get("name");
  if (typeof name !== "string" || !name) {
    throw new Error("Company name is required.");
  }

  const domain = formData.get("domain");
  const industry = formData.get("industry");
  const website = formData.get("website");

  const company = await createCompany({
    name,
    domain: typeof domain === "string" && domain ? domain : undefined,
    industry: typeof industry === "string" && industry ? industry : undefined,
    website: typeof website === "string" && website ? website : undefined,
  });

  revalidatePath("/staff/companies");
  redirect(`/staff/companies/${company.id}`);
}
