import { prisma } from "@platform/db";
import { stripe } from "@/lib/stripe";
import { ValidationError } from "@/lib/crm/errors";

export async function createBillingPortalSession(tenantId: string, userId: string): Promise<string> {
  const [tenant, tenantCustomer] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.tenantCustomer.findUnique({ where: { tenantId_userId: { tenantId, userId } } }),
  ]);

  if (!tenantCustomer) {
    throw new ValidationError("No billing history yet with this business — make a purchase or subscribe first.");
  }
  if (!tenant.stripeConnectAccountId) {
    throw new ValidationError("This business hasn't connected Stripe yet.");
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create(
    { customer: tenantCustomer.stripeCustomerId, return_url: `${appUrl}/portal` },
    { stripeAccount: tenant.stripeConnectAccountId },
  );

  return session.url;
}
