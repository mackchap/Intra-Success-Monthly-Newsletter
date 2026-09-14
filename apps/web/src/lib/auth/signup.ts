import { hash } from "bcryptjs";
import { prisma } from "@platform/db";
import { ValidationError } from "@/lib/crm/errors";

export interface CreateUserAccountInput {
  email: string;
  password: string;
  name?: string;
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

  // If this email already exists as a CRM contact (e.g. captured by a
  // funnel opt-in before they had an account), link the two records so
  // staff see one unified record instead of an orphaned contact.
  await prisma.contact.updateMany({
    where: { email: input.email, userId: null },
    data: { userId: user.id },
  });

  return user;
}
