"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createContact } from "@/lib/crm/contacts";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { str } from "@/lib/form-data";

export async function createContactAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "STAFF");

  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    throw new Error("Email is required.");
  }

  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const phone = formData.get("phone");
  const companyId = formData.get("companyId");

  const contact = await createContact({
    tenantId,
    email,
    firstName: typeof firstName === "string" && firstName ? firstName : undefined,
    lastName: typeof lastName === "string" && lastName ? lastName : undefined,
    phone: typeof phone === "string" && phone ? phone : undefined,
    companyId: typeof companyId === "string" && companyId ? companyId : undefined,
  });

  revalidatePath(`/a/${tenantId}/staff/contacts`);
  redirect(`/a/${tenantId}/staff/contacts/${contact.id}`);
}
