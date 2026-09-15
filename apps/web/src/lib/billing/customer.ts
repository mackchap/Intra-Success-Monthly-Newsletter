import { prisma } from "@platform/db";
import { stripe } from "@/lib/stripe";
import { ValidationError } from "@/lib/crm/errors";

// Every (Tenant, User) pair gets at most one Stripe Customer, created on
// that tenant's own connected Stripe account — Stripe Connect customers
// live on the connected account, not the platform's, so the same person
// buying from two different tenants is two different Customer objects (see
// TenantCustomer's schema comment and CLAUDE.md's Phase 9 section for why
// this replaced the old single global User.stripeCustomerId).
export async function getOrCreateStripeCustomerId(tenantId: string, userId: string): Promise<string> {
  const existing = await prisma.tenantCustomer.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (existing) return existing.stripeCustomerId;

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (!tenant.stripeConnectAccountId) {
    throw new ValidationError("This business hasn't connected Stripe yet — nothing can be purchased from it.");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const customer = await stripe.customers.create(
    { email: user.email ?? undefined, name: user.name ?? undefined, metadata: { userId: user.id, tenantId } },
    { stripeAccount: tenant.stripeConnectAccountId },
  );

  await prisma.tenantCustomer.create({
    data: { tenantId, userId, stripeCustomerId: customer.id },
  });

  return customer.id;
}
