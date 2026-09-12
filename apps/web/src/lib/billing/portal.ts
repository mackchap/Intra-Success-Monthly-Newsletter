import { prisma } from "@platform/db";
import { stripe } from "@/lib/stripe";
import { ValidationError } from "@/lib/crm/errors";

export async function createBillingPortalSession(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.stripeCustomerId) {
    throw new ValidationError("No billing history yet — make a purchase or subscribe first.");
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/portal`,
  });

  return session.url;
}
