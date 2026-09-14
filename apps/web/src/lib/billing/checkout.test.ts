import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      product: { findUniqueOrThrow: vi.fn() },
      tenant: { findUniqueOrThrow: vi.fn() },
      tenantCustomer: { findUnique: vi.fn(), create: vi.fn() },
      user: { findUniqueOrThrow: vi.fn() },
      order: { create: vi.fn(), update: vi.fn() },
      deal: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}));

vi.mock("@/lib/queues/sequence-triggers", () => ({
  enqueueAbandonedCheckoutCheck: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@platform/db";
import { stripe } from "@/lib/stripe";
import { enqueueAbandonedCheckoutCheck } from "@/lib/queues/sequence-triggers";
import { createCheckoutSession } from "./checkout";
import { ValidationError } from "@/lib/crm/errors";

const CONNECTED_TENANT = {
  id: "tenant_1",
  name: "Acme Co",
  stripeConnectAccountId: "acct_1",
  chargesEnabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = "https://example.test";
  vi.mocked(prisma.tenant.findUniqueOrThrow).mockResolvedValue(CONNECTED_TENANT as never);
});

describe("createCheckoutSession", () => {
  it("throws if the product has no synced Stripe price yet", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_1",
      name: "Sample Course",
      stripePriceId: null,
    } as never);

    await expect(createCheckoutSession({ productId: "product_1", userId: "user_1" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("throws if the product's tenant hasn't connected Stripe yet", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_1",
      name: "Sample Course",
      tenantId: "tenant_1",
      stripePriceId: "price_1",
    } as never);
    vi.mocked(prisma.tenant.findUniqueOrThrow).mockResolvedValue({
      id: "tenant_1",
      name: "Acme Co",
      stripeConnectAccountId: null,
      chargesEnabled: false,
    } as never);

    await expect(createCheckoutSession({ productId: "product_1", userId: "user_1" })).rejects.toThrow(
      ValidationError,
    );
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("reuses an existing Stripe customer, creates a pending order, and returns the checkout url", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_1",
      name: "Sample Course",
      type: "COURSE",
      tenantId: "tenant_1",
      stripePriceId: "price_1",
      priceCents: 9900,
      currency: "usd",
      courseId: "course_1",
    } as never);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: "user_1",
      email: "buyer@example.com",
    } as never);
    vi.mocked(prisma.tenantCustomer.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_existing",
    } as never);
    vi.mocked(prisma.order.create).mockResolvedValue({ id: "order_1" } as never);
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/session/cs_1",
    } as never);

    const url = await createCheckoutSession({ productId: "product_1", userId: "user_1" });

    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant_1", userId: "user_1", productId: "product_1", courseId: "course_1" }),
      }),
    );
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer: "cus_existing",
        line_items: [{ price: "price_1", quantity: 1 }],
      }),
      { stripeAccount: "acct_1" },
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { stripeCheckoutSessionId: "cs_1" },
    });
    expect(url).toBe("https://checkout.stripe.com/session/cs_1");
    expect(enqueueAbandonedCheckoutCheck).not.toHaveBeenCalled();
  });

  it("links the order to the deal's contact/funnel and schedules an abandoned-checkout check for funnel deals", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_1",
      name: "Sample Course",
      type: "COURSE",
      tenantId: "tenant_1",
      stripePriceId: "price_1",
      priceCents: 9900,
      currency: "usd",
      courseId: "course_1",
    } as never);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: "user_1",
      email: "buyer@example.com",
    } as never);
    vi.mocked(prisma.tenantCustomer.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_existing",
    } as never);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({
      id: "deal_1",
      contactId: "contact_1",
      funnelId: "funnel_1",
    } as never);
    vi.mocked(prisma.order.create).mockResolvedValue({ id: "order_1" } as never);
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/session/cs_1",
    } as never);

    await createCheckoutSession({ productId: "product_1", userId: "user_1", dealId: "deal_1" });

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dealId: "deal_1", contactId: "contact_1", funnelId: "funnel_1" }),
      }),
    );
    expect(enqueueAbandonedCheckoutCheck).toHaveBeenCalledWith("order_1", 60);
  });

  it("does not schedule an abandoned-checkout check for a deal with no funnel", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_1",
      name: "Sample Course",
      type: "COURSE",
      tenantId: "tenant_1",
      stripePriceId: "price_1",
      priceCents: 9900,
      currency: "usd",
      courseId: "course_1",
    } as never);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: "user_1",
      email: "buyer@example.com",
    } as never);
    vi.mocked(prisma.tenantCustomer.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_existing",
    } as never);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ id: "deal_1", contactId: "contact_1", funnelId: null } as never);
    vi.mocked(prisma.order.create).mockResolvedValue({ id: "order_1" } as never);
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/session/cs_1",
    } as never);

    await createCheckoutSession({ productId: "product_1", userId: "user_1", dealId: "deal_1" });

    expect(enqueueAbandonedCheckoutCheck).not.toHaveBeenCalled();
  });

  it("uses subscription mode for MEMBERSHIP products, creating a new Stripe customer on the connected account", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_2",
      name: "Founding Member",
      type: "MEMBERSHIP",
      tenantId: "tenant_1",
      stripePriceId: "price_2",
      priceCents: 2900,
      currency: "usd",
      courseId: null,
    } as never);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: "user_2",
      email: "member@example.com",
      name: null,
    } as never);
    vi.mocked(prisma.tenantCustomer.findUnique).mockResolvedValue(null);
    vi.mocked(stripe.customers.create).mockResolvedValue({ id: "cus_new" } as never);
    vi.mocked(prisma.order.create).mockResolvedValue({ id: "order_2" } as never);
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_2",
      url: "https://checkout.stripe.com/session/cs_2",
    } as never);

    await createCheckoutSession({ productId: "product_2", userId: "user_2" });

    expect(stripe.customers.create).toHaveBeenCalledWith(expect.any(Object), { stripeAccount: "acct_1" });
    expect(prisma.tenantCustomer.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant_1", userId: "user_2", stripeCustomerId: "cus_new" },
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription" }),
      { stripeAccount: "acct_1" },
    );
  });
});
