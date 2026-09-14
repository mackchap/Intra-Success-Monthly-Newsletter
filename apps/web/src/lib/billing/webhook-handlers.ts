import type Stripe from "stripe";
import {
  prisma,
  ActivityType,
  DealStatus,
  EnrollmentStatus,
  EnrollmentSource,
  OrderStatus,
  ProductType,
  StripeConnectStatus,
  SubscriptionStatus,
} from "@platform/db";
import { moveDealStage } from "@/lib/crm/deals";
import { revokeMembershipEnrollments } from "@/lib/academy/enrollment";
import {
  handlePlatformCheckoutCompleted,
  handlePlatformSubscriptionDeleted,
  handlePlatformSubscriptionUpsert,
} from "@/lib/billing/platform-subscription";

// ---------------------------------------------------------------------------
// Product/Price sync — Stripe Dashboard/API is the source of truth for what's
// for sale; we mirror it here rather than managing a separate catalog. App-
// specific fields (which ProductType, which Course it grants) travel as
// Stripe Product metadata (metadata.type, metadata.courseId), set when the
// product is created in Stripe.
// ---------------------------------------------------------------------------

function parseProductType(value: string | undefined): ProductType {
  if (value === ProductType.COURSE || value === ProductType.FUNNEL_OFFER || value === ProductType.MEMBERSHIP) {
    return value;
  }
  return ProductType.FUNNEL_OFFER;
}

export async function handleProductUpsert(product: Stripe.Product) {
  const type = parseProductType(product.metadata?.type);
  const courseId = product.metadata?.courseId || null;

  await prisma.product.upsert({
    where: { stripeProductId: product.id },
    update: { name: product.name, type, courseId },
    create: {
      stripeProductId: product.id,
      name: product.name,
      type,
      courseId,
      priceCents: 0,
      currency: "usd",
    },
  });
}

export async function handlePriceUpsert(price: Stripe.Price) {
  if (typeof price.product !== "string" || price.unit_amount == null) {
    // Expanded product object or a non-fixed (e.g. metered/tiered) price —
    // out of scope for Phase 3's one-time/flat-subscription pricing.
    return;
  }

  await prisma.product.upsert({
    where: { stripeProductId: price.product },
    update: { stripePriceId: price.id, priceCents: price.unit_amount, currency: price.currency },
    create: {
      stripeProductId: price.product,
      stripePriceId: price.id,
      priceCents: price.unit_amount,
      currency: price.currency,
      name: "Untitled product",
      type: ProductType.FUNNEL_OFFER,
    },
  });
}

// ---------------------------------------------------------------------------
// Checkout / orders
// ---------------------------------------------------------------------------

async function closeDealAsWon(dealId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.status !== DealStatus.OPEN) {
    // Already closed (or the deal is gone) — nothing to do. Guards against
    // double-processing on top of the WebhookEvent-level idempotency check.
    return;
  }

  const wonStage = await prisma.pipelineStage.findFirst({
    where: { pipelineId: deal.pipelineId, isWon: true },
  });
  if (!wonStage) {
    console.warn(`Pipeline ${deal.pipelineId} has no "won" stage; leaving deal ${dealId} open.`);
    return;
  }

  await moveDealStage(dealId, wonStage.id);
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const order = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session.id } });
  if (!order) {
    console.warn(`No matching Order for checkout session ${session.id}`);
    return;
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PAID,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    },
  });

  if (updated.courseId && updated.userId) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: updated.userId, courseId: updated.courseId } },
      update: { status: EnrollmentStatus.ACTIVE, revokedAt: null },
      create: {
        userId: updated.userId,
        courseId: updated.courseId,
        source: EnrollmentSource.STRIPE_PURCHASE,
      },
    });
  }

  if (updated.dealId) {
    await closeDealAsWon(updated.dealId);
  }

  if (updated.contactId || updated.dealId) {
    // Contact/Deal are already tenant-scoped (Phase 8) — derive the
    // Activity's tenantId from whichever of them this order is attached to,
    // rather than assuming a tenant here.
    const tenantId = updated.dealId
      ? (await prisma.deal.findUnique({ where: { id: updated.dealId }, select: { tenantId: true } }))?.tenantId
      : (await prisma.contact.findUnique({ where: { id: updated.contactId! }, select: { tenantId: true } }))
          ?.tenantId;

    if (tenantId) {
      await prisma.activity.create({
        data: {
          tenantId,
          type: ActivityType.ORDER_PAID,
          contactId: updated.contactId,
          dealId: updated.dealId,
          metadata: { orderId: updated.id, amountCents: updated.amountCents },
        },
      });
    }
  }
}

export async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
  if (!paymentIntentId) return;

  const order = await prisma.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!order) return;

  await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });

  if (order.userId && order.courseId) {
    await prisma.enrollment.updateMany({
      where: {
        userId: order.userId,
        courseId: order.courseId,
        status: EnrollmentStatus.ACTIVE,
      },
      data: { status: EnrollmentStatus.REVOKED, revokedAt: new Date() },
    });
  }
}

// ---------------------------------------------------------------------------
// Subscriptions / memberships
// ---------------------------------------------------------------------------

function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
    case "unpaid":
    case "paused":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "incomplete":
    case "incomplete_expired":
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

export async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) {
    console.warn(`No user found for Stripe customer ${customerId}`);
    return;
  }

  const item = subscription.items.data[0];
  const plan = item?.price?.nickname ?? item?.price?.id ?? "unknown";
  const currentPeriodEnd = item ? new Date(item.current_period_end * 1000) : new Date();

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: mapSubscriptionStatus(subscription.status),
      plan,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      userId: user.id,
      status: mapSubscriptionStatus(subscription.status),
      plan,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: SubscriptionStatus.CANCELED },
  });

  // A MEMBERSHIP-tier course's access is only as good as the subscription
  // that granted it — unlike a one-time STRIPE_PURCHASE enrollment, which
  // stays ACTIVE regardless of later subscription changes. (Phase 4.)
  await revokeMembershipEnrollments(existing.userId);
}

// ---------------------------------------------------------------------------
// Stripe Connect (tenant-connected accounts)
// ---------------------------------------------------------------------------

// Stripe sends account.updated for a connected account's own events too
// (once Connect events are enabled on the webhook endpoint), distinguished
// by `event.account` being set — see processStripeWebhookEvent below. This
// is the authoritative status source; the onboarding return_url
// (lib/billing/connect.ts's syncConnectAccountStatus) just avoids a stale
// UI in between.
export async function handleConnectAccountUpdated(account: Stripe.Account): Promise<void> {
  const status = account.charges_enabled
    ? StripeConnectStatus.ACTIVE
    : account.details_submitted
      ? StripeConnectStatus.PENDING
      : StripeConnectStatus.PENDING;

  await prisma.tenant.updateMany({
    where: { stripeConnectAccountId: account.id },
    data: { stripeConnectStatus: status, chargesEnabled: account.charges_enabled ?? false },
  });
}

// ---------------------------------------------------------------------------
// Dispatch + idempotency
// ---------------------------------------------------------------------------

export async function processStripeWebhookEvent(event: Stripe.Event) {
  const existing = await prisma.webhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.processedAt) {
    return { duplicate: true };
  }

  if (!existing) {
    await prisma.webhookEvent.create({
      data: { stripeEventId: event.id, type: event.type, payload: event as unknown as object },
    });
  }

  switch (event.type) {
    case "product.created":
    case "product.updated":
      await handleProductUpsert(event.data.object as Stripe.Product);
      break;
    case "price.created":
    case "price.updated":
      await handlePriceUpsert(event.data.object as Stripe.Price);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind === "platform_subscription") {
        await handlePlatformCheckoutCompleted(session);
      } else {
        await handleCheckoutSessionCompleted(session);
      }
      break;
    }
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      // Two independent, non-overlapping customer namespaces on the same
      // Stripe account (a tenant's own customer vs. the tenant itself) — each
      // handler no-ops if the event's customer id isn't theirs.
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
      await handlePlatformSubscriptionUpsert(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      await handlePlatformSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "account.updated":
      // Only ever fires for a connected (Tenant) account, never the
      // platform's own — see handleConnectAccountUpdated.
      await handleConnectAccountUpdated(event.data.object as Stripe.Account);
      break;
    default:
      // Unhandled event types are acknowledged, not errors.
      break;
  }

  await prisma.webhookEvent.update({
    where: { stripeEventId: event.id },
    data: { processedAt: new Date() },
  });

  return { duplicate: false };
}
