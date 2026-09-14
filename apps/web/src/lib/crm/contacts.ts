import { prisma } from "@platform/db";
import { enqueueLeadQualification } from "@/lib/queues/lead-qualification";

export interface CreateContactInput {
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyId?: string;
  ownerId?: string;
  source?: string;
}

export async function createContact(input: CreateContactInput) {
  const contact = await prisma.contact.create({
    data: {
      tenantId: input.tenantId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      companyId: input.companyId,
      ownerId: input.ownerId,
      source: input.source ?? "manual",
    },
  });

  // Best-effort: a stalled Redis/worker shouldn't fail contact creation
  // itself, only the background AI qualification that depends on it.
  enqueueLeadQualification(contact.id).catch((error) =>
    console.warn(`Failed to enqueue lead qualification for contact ${contact.id}:`, error),
  );

  return contact;
}
