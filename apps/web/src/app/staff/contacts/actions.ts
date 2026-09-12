"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createContact } from "@/lib/crm/contacts";
import { requireStaffSession } from "@/lib/require-staff";

export async function createContactAction(formData: FormData) {
  await requireStaffSession();

  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    throw new Error("Email is required.");
  }

  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const phone = formData.get("phone");
  const companyId = formData.get("companyId");

  const contact = await createContact({
    email,
    firstName: typeof firstName === "string" && firstName ? firstName : undefined,
    lastName: typeof lastName === "string" && lastName ? lastName : undefined,
    phone: typeof phone === "string" && phone ? phone : undefined,
    companyId: typeof companyId === "string" && companyId ? companyId : undefined,
  });

  revalidatePath("/staff/contacts");
  redirect(`/staff/contacts/${contact.id}`);
}
