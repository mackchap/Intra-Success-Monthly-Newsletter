import { prisma, ProductType } from "@platform/db";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomerId } from "./customer";
import { ValidationError } from "@/lib/crm/errors";
import { enqueueAbandonedCheckoutCheck } from "@/lib/queues/sequence-triggers";

export interface CreateCheckoutSessionInput {
  productId: string;
  userId: string;
  /** Optional CRM deal to mark won when the resulting order is paid (funnel offers). */
  dealId?: string;
}

// Creates a pending Order up front (before redirecting to Stripe) so the
// webhook handler has a stable row to update by stripeCheckoutSessionId
// rather than trying to reconstruct order details from the Stripe event.
// Everything here runs on the PRODUCT'S OWN TENANT's connected Stripe
// account (Phase 9) — this money is the tenant's, not the platform's.
export async function createCheckoutSession(input: CreateCheckoutSessionInput) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: input.productId } });

  if (!product.stripePriceId) {
    throw new ValidationError(
      `Product "${product.name}" has no Stripe price yet — it hasn't synced from Stripe (create/publish it on the connected Stripe account first).`,
    );
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: product.tenantId } });
  if (!tenant.stripeConnectAccountId || !tenant.chargesEnabled) {
    throw new ValidationError(
      `${tenant.name} hasn't finished connecting Stripe yet — this product can't be purchased until they do.`,
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const customerId = await getOrCreateStripeCustomerId(tenant.id, input.userId);
  const deal = input.dealId ? await prisma.deal.findUnique({ where: { id: input.dealId } }) : null;

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      email: user.email ?? "",
      amountCents: product.priceCents,
      currency: product.currency,
      userId: user.id,
      productId: product.id,
      courseId: product.courseId,
      listingId: product.listingId,
      dealId: input.dealId,
      contactId: deal?.contactId,
      funnelId: deal?.funnelId,
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const mode = product.type === ProductType.MEMBERSHIP ? "subscription" : "payment";

  const session = await stripe.checkout.sessions.create(
    {
      mode,
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: product.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      metadata: { orderId: order.id, productId: product.id, tenantId: tenant.id },
    },
    { stripeAccount: tenant.stripeConnectAccountId },
  );

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  if (deal?.funnelId) {
    // Best-effort: a stalled Redis/worker shouldn't block checkout itself,
    // only the abandoned-checkout nurture sequence that depends on it.
    enqueueAbandonedCheckoutCheck(order.id, 60).catch((error) =>
      console.warn(`Failed to enqueue abandoned-checkout check for order ${order.id}:`, error),
    );
  }

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return session.url;
}
