import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      tenant: { findUniqueOrThrow: vi.fn() },
      tenantCustomer: { findUnique: vi.fn() },
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
  vi.mocked(prisma.tenant.findUniqueOrThrow).mockResolvedValue({
    id: "tenant_1",
    stripeConnectAccountId: "acct_1",
  } as never);
});

describe("createBillingPortalSession", () => {
  it("throws if the user has no Stripe customer with this tenant yet", async () => {
    vi.mocked(prisma.tenantCustomer.findUnique).mockResolvedValue(null);

    await expect(createBillingPortalSession("tenant_1", "user_1")).rejects.toThrow(ValidationError);
  });

  it("throws if the tenant hasn't connected Stripe yet", async () => {
    vi.mocked(prisma.tenantCustomer.findUnique).mockResolvedValue({ stripeCustomerId: "cus_1" } as never);
    vi.mocked(prisma.tenant.findUniqueOrThrow).mockResolvedValue({
      id: "tenant_1",
      stripeConnectAccountId: null,
    } as never);

    await expect(createBillingPortalSession("tenant_1", "user_1")).rejects.toThrow(ValidationError);
  });

  it("creates a portal session on the tenant's connected account for the user's Stripe customer", async () => {
    vi.mocked(prisma.tenantCustomer.findUnique).mockResolvedValue({ stripeCustomerId: "cus_1" } as never);
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      url: "https://billing.stripe.com/session/1",
    } as never);

    const url = await createBillingPortalSession("tenant_1", "user_1");

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      { customer: "cus_1", return_url: "https://example.test/portal" },
      { stripeAccount: "acct_1" },
    );
    expect(url).toBe("https://billing.stripe.com/session/1");
  });
});
