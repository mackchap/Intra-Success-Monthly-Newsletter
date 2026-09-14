import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      product: { upsert: vi.fn() },
      order: { findUnique: vi.fn(), update: vi.fn() },
      enrollment: { upsert: vi.fn(), updateMany: vi.fn() },
      deal: { findUnique: vi.fn() },
      pipelineStage: { findFirst: vi.fn() },
      activity: { create: vi.fn() },
      subscription: { upsert: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      user: { findUnique: vi.fn() },
      webhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    },
  };
});

vi.mock("@/lib/crm/deals", () => ({
  moveDealStage: vi.fn(),
}));

vi.mock("@/lib/academy/enrollment", () => ({
  revokeMembershipEnrollments: vi.fn(),
}));

import { prisma } from "@platform/db";
import { moveDealStage } from "@/lib/crm/deals";
import { revokeMembershipEnrollments } from "@/lib/academy/enrollment";
import {
  handleCheckoutSessionCompleted,
  handleChargeRefunded,
  handlePriceUpsert,
  handleProductUpsert,
  handleSubscriptionDeleted,
  handleSubscriptionUpsert,
  processStripeWebhookEvent,
} from "./webhook-handlers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleProductUpsert", () => {
  it("syncs a Stripe product using its metadata to set type/courseId", async () => {
    await handleProductUpsert({
      id: "prod_1",
      name: "Founding Member",
      metadata: { type: "MEMBERSHIP" },
    } as unknown as Stripe.Product);

    expect(prisma.product.upsert).toHaveBeenCalledWith({
      where: { stripeProductId: "prod_1" },
      update: { name: "Founding Member", type: "MEMBERSHIP", courseId: null },
      create: expect.objectContaining({ stripeProductId: "prod_1", name: "Founding Member", type: "MEMBERSHIP" }),
    });
  });

  it("falls back to FUNNEL_OFFER for missing/unknown metadata.type", async () => {
    await handleProductUpsert({ id: "prod_2", name: "Mystery box", metadata: {} } as unknown as Stripe.Product);

    expect(prisma.product.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ type: "FUNNEL_OFFER" }) }),
    );
  });
});

describe("handlePriceUpsert", () => {
  it("syncs a fixed-amount price onto its product", async () => {
    await handlePriceUpsert({
      id: "price_1",
      product: "prod_1",
      unit_amount: 9900,
      currency: "usd",
    } as unknown as Stripe.Price);

    expect(prisma.product.upsert).toHaveBeenCalledWith({
      where: { stripeProductId: "prod_1" },
      update: { stripePriceId: "price_1", priceCents: 9900, currency: "usd" },
      create: expect.objectContaining({ stripeProductId: "prod_1", stripePriceId: "price_1" }),
    });
  });

  it("skips prices with no fixed unit_amount", async () => {
    await handlePriceUpsert({ id: "price_2", product: "prod_1", unit_amount: null } as unknown as Stripe.Price);

    expect(prisma.product.upsert).not.toHaveBeenCalled();
  });
});

describe("handleCheckoutSessionCompleted", () => {
  it("does nothing if no matching Order exists", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    await handleCheckoutSessionCompleted({ id: "cs_1", payment_intent: "pi_1" } as unknown as Stripe.Checkout.Session);

    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("marks the order paid and enrolls the user when the order is for a course", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "order_1" } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      courseId: "course_1",
      dealId: null,
      contactId: null,
      amountCents: 9900,
    } as never);

    await handleCheckoutSessionCompleted({
      id: "cs_1",
      payment_intent: "pi_1",
    } as unknown as Stripe.Checkout.Session);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { status: "PAID", stripePaymentIntentId: "pi_1" },
    });
    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
        create: expect.objectContaining({ source: "STRIPE_PURCHASE" }),
      }),
    );
  });

  it("closes the linked deal as won when the order is tied to a CRM deal", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "order_2" } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({
      id: "order_2",
      userId: "user_1",
      courseId: null,
      dealId: "deal_1",
      contactId: "contact_1",
      amountCents: 5000,
    } as never);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({
      id: "deal_1",
      tenantId: "tenant-1",
      status: "OPEN",
      pipelineId: "pipeline_1",
    } as never);
    vi.mocked(prisma.pipelineStage.findFirst).mockResolvedValue({ id: "stage_won" } as never);

    await handleCheckoutSessionCompleted({ id: "cs_2" } as unknown as Stripe.Checkout.Session);

    expect(moveDealStage).toHaveBeenCalledWith("deal_1", "stage_won");
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-1", type: "ORDER_PAID", dealId: "deal_1", contactId: "contact_1" }),
    });
  });

  it("does not try to close a deal that is already closed", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "order_3" } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({
      id: "order_3",
      userId: "user_1",
      courseId: null,
      dealId: "deal_2",
      contactId: null,
      amountCents: 5000,
    } as never);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ id: "deal_2", status: "WON", pipelineId: "pipeline_1" } as never);

    await handleCheckoutSessionCompleted({ id: "cs_3" } as unknown as Stripe.Checkout.Session);

    expect(moveDealStage).not.toHaveBeenCalled();
  });
});

describe("handleChargeRefunded", () => {
  it("marks the order refunded and revokes the course enrollment", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      courseId: "course_1",
    } as never);

    await handleChargeRefunded({ payment_intent: "pi_1" } as unknown as Stripe.Charge);

    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: "order_1" }, data: { status: "REFUNDED" } });
    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", courseId: "course_1", status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: expect.any(Date) },
    });
  });

  it("does nothing if there's no matching order", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    await handleChargeRefunded({ payment_intent: "pi_missing" } as unknown as Stripe.Charge);

    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionUpsert", () => {
  it("upserts a Subscription for the matching user, mapping Stripe status", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user_1" } as never);

    await handleSubscriptionUpsert({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { nickname: "Founding Member", id: "price_1" }, current_period_end: 1_800_000_000 }] },
    } as unknown as Stripe.Subscription);

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_1" },
        update: expect.objectContaining({ status: "ACTIVE", plan: "Founding Member" }),
      }),
    );
  });

  it("skips silently if no user matches the Stripe customer", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await handleSubscriptionUpsert({
      id: "sub_2",
      customer: "cus_missing",
      status: "active",
      items: { data: [] },
    } as unknown as Stripe.Subscription);

    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionDeleted", () => {
  it("marks the subscription canceled and revokes membership enrollments for its user", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      userId: "user_1",
    } as never);

    await handleSubscriptionDeleted({ id: "sub_1" } as unknown as Stripe.Subscription);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_1" },
      data: { status: "CANCELED" },
    });
    expect(revokeMembershipEnrollments).toHaveBeenCalledWith("user_1");
  });

  it("does nothing if the subscription was never synced", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

    await handleSubscriptionDeleted({ id: "sub_missing" } as unknown as Stripe.Subscription);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(revokeMembershipEnrollments).not.toHaveBeenCalled();
  });
});

describe("processStripeWebhookEvent", () => {
  it("processes a new event and marks it processed", async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const result = await processStripeWebhookEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    } as unknown as Stripe.Event);

    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
      data: { stripeEventId: "evt_1", type: "checkout.session.completed", payload: expect.anything() },
    });
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { stripeEventId: "evt_1" },
      data: { processedAt: expect.any(Date) },
    });
    expect(result).toEqual({ duplicate: false });
  });

  it("skips already-processed events instead of re-running the handler", async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({ processedAt: new Date() } as never);

    const result = await processStripeWebhookEvent({
      id: "evt_2",
      type: "checkout.session.completed",
      data: { object: {} },
    } as unknown as Stripe.Event);

    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(result).toEqual({ duplicate: true });
  });

  it("does not error on an unhandled event type", async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null);

    await expect(
      processStripeWebhookEvent({
        id: "evt_3",
        type: "some.unhandled.event",
        data: { object: {} },
      } as unknown as Stripe.Event),
    ).resolves.toEqual({ duplicate: false });
  });
});
