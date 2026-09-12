import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      user: { findUniqueOrThrow: vi.fn() },
    },
  };
});

vi.mock("@/lib/stripe", () => ({
  stripe: {
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

import { prisma } from "@platform/db";
import { stripe } from "@/lib/stripe";
import { createBillingPortalSession } from "./portal";
import { ValidationError } from "@/lib/crm/errors";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = "https://example.test";
});

describe("createBillingPortalSession", () => {
  it("throws if the user has no Stripe customer yet", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ id: "user_1", stripeCustomerId: null } as never);

    await expect(createBillingPortalSession("user_1")).rejects.toThrow(ValidationError);
  });

  it("creates a portal session for the user's Stripe customer", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: "user_1",
      stripeCustomerId: "cus_1",
    } as never);
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      url: "https://billing.stripe.com/session/1",
    } as never);

    const url = await createBillingPortalSession("user_1");

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://example.test/portal",
    });
    expect(url).toBe("https://billing.stripe.com/session/1");
  });
});
