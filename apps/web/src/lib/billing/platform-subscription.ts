import type Stripe from "stripe";
import { prisma, PlatformSubscriptionStatus } from "@platform/db";
import { stripe } from "@/lib/stripe";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

// What a Tenant pays *this platform* to use it at all — entirely separate
// from anything the Tenant charges their own customers (which settles on
// their connected Stripe account, see lib/billing/connect.ts). This
// checkout always runs on the platform's own Stripe account, never Connect.
// Phase 8 ships exactly one paid plan; tiered plans are a fast-follow once
// there's a reason to differentiate them.
export async function createPlatformCheckoutSession(tenantId: string, userEmail: string): Promise<string> {
  const priceId = process.env.PLATFORM_STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("PLATFORM_STRIPE_PRICE_ID is not configured.");
  }

  const platformSubscription = await prisma.platformSubscription.findUnique({ where: { tenantId } });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(platformSubscription?.stripeCustomerId
      ? { customer: platformSubscription.stripeCustomerId }
      : { customer_email: userEmail }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/a/${tenantId}/staff/settings/billing?platform_subscribed=1`,
    cancel_url: `${appUrl()}/a/${tenantId}/staff/settings/billing`,
    metadata: { tenantId, kind: "platform_subscription" },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL.");
  }
  return session.url;
}

export async function handlePlatformCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const tenantId = session.metadata?.tenantId;
  if (!tenantId) return;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!customerId || !subscriptionId) return;

  await prisma.platformSubscription.update({
    where: { tenantId },
    data: { stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, status: PlatformSubscriptionStatus.ACTIVE },
  });
}

function mapPlatformSubscriptionStatus(status: Stripe.Subscription.Status): PlatformSubscriptionStatus {
  switch (status) {
    case "active":
      return PlatformSubscriptionStatus.ACTIVE;
    case "trialing":
      return PlatformSubscriptionStatus.TRIALING;
    case "past_due":
    case "unpaid":
    case "paused":
      return PlatformSubscriptionStatus.PAST_DUE;
    case "canceled":
    case "incomplete_expired":
    default:
      return PlatformSubscriptionStatus.CANCELED;
  }
}

// Distinct from handleSubscriptionUpsert (a Tenant's own customer paying for
// a course/membership) — this is the Tenant itself paying the platform.
// Both are Stripe Customers on the same (platform) Stripe account, just
// different Customer objects, so this only ever matches platform-plan events.
export async function handlePlatformSubscriptionUpsert(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const existing = await prisma.platformSubscription.findFirst({ where: { stripeCustomerId: customerId } });
  if (!existing) return;

  const item = subscription.items.data[0];
  const currentPeriodEnd = item ? new Date(item.current_period_end * 1000) : undefined;

  await prisma.platformSubscription.update({
    where: { id: existing.id },
    data: {
      status: mapPlatformSubscriptionStatus(subscription.status),
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

export async function handlePlatformSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const existing = await prisma.platformSubscription.findFirst({ where: { stripeCustomerId: customerId } });
  if (!existing) return;

  await prisma.platformSubscription.update({
    where: { id: existing.id },
    data: { status: PlatformSubscriptionStatus.CANCELED },
  });
}
