import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      product: { findUniqueOrThrow: vi.fn() },
      user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
      order: { create: vi.fn(), update: vi.fn() },
    },
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { prisma } from "@platform/db";
import { stripe } from "@/lib/stripe";
import { createCheckoutSession } from "./checkout";
import { ValidationError } from "@/lib/crm/errors";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = "https://example.test";
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

  it("reuses an existing Stripe customer, creates a pending order, and returns the checkout url", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_1",
      name: "Sample Course",
      type: "COURSE",
      stripePriceId: "price_1",
      priceCents: 9900,
      currency: "usd",
      courseId: "course_1",
    } as never);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: "user_1",
      email: "buyer@example.com",
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
        data: expect.objectContaining({ userId: "user_1", productId: "product_1", courseId: "course_1" }),
      }),
    );
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer: "cus_existing",
        line_items: [{ price: "price_1", quantity: 1 }],
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { stripeCheckoutSessionId: "cs_1" },
    });
    expect(url).toBe("https://checkout.stripe.com/session/cs_1");
  });

  it("uses subscription mode for MEMBERSHIP products", async () => {
    vi.mocked(prisma.product.findUniqueOrThrow).mockResolvedValue({
      id: "product_2",
      name: "Founding Member",
      type: "MEMBERSHIP",
      stripePriceId: "price_2",
      priceCents: 2900,
      currency: "usd",
      courseId: null,
    } as never);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: "user_2",
      email: "member@example.com",
      stripeCustomerId: null,
    } as never);
    vi.mocked(stripe.customers.create).mockResolvedValue({ id: "cus_new" } as never);
    vi.mocked(prisma.order.create).mockResolvedValue({ id: "order_2" } as never);
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_2",
      url: "https://checkout.stripe.com/session/cs_2",
    } as never);

    await createCheckoutSession({ productId: "product_2", userId: "user_2" });

    expect(stripe.customers.create).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: { stripeCustomerId: "cus_new" },
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "subscription" }));
  });
});
