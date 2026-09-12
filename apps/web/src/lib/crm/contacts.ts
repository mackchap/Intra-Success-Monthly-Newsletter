import { prisma } from "@platform/db";

export interface CreateContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyId?: string;
  ownerId?: string;
  source?: string;
}

export async function createContact(input: CreateContactInput) {
  return prisma.contact.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      companyId: input.companyId,
      ownerId: input.ownerId,
      source: input.source ?? "manual",
    },
  });
}
