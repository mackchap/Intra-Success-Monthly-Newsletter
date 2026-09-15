import { hash } from "bcryptjs";
import { prisma } from "@platform/db";
import { ValidationError } from "@/lib/crm/errors";

export interface CreateUserAccountInput {
  email: string;
  password: string;
  name?: string;
  // The tenant this signup is happening in the context of (e.g. the funnel
  // they came from) — Contact is tenant-scoped (Phase 8), and the same
  // email can be a contact of several different tenants, so linking must be
  // scoped to one specific tenant rather than matching every tenant's
  // contact with this email.
  tenantId?: string;
}

export async function createUserAccount(input: CreateUserAccountInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ValidationError("An account with this email already exists — sign in instead.");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: await hash(input.password, 10),
    },
  });

  // If this email already exists as a CRM contact in the relevant tenant
  // (e.g. captured by that tenant's funnel opt-in before they had an
  // account), link the two records so staff see one unified record instead
  // of an orphaned contact. Skipped for a tenant-less signup — nothing to
  // link to.
  if (input.tenantId) {
    await prisma.contact.updateMany({
      where: { tenantId: input.tenantId, email: input.email, userId: null },
      data: { userId: user.id },
    });
  }

  return user;
}
