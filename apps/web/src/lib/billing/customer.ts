import { prisma } from "@platform/db";
import { stripe } from "@/lib/stripe";

// Every user gets at most one Stripe Customer, reused across every purchase
// and subscription so the billing portal and payment history stay unified.
export async function getOrCreateStripeCustomerId(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
