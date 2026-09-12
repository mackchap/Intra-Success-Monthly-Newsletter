import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      funnelVisit: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      funnelStep: { findMany: vi.fn() },
      funnelSubmission: { count: vi.fn(), findMany: vi.fn() },
      order: { aggregate: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import { getFunnelAnalytics, logFunnelVisit } from "./analytics";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logFunnelVisit", () => {
  it("creates a FunnelVisit row from the given input", async () => {
    vi.mocked(prisma.funnelVisit.create).mockResolvedValue({ id: "visit_1" } as never);

    await logFunnelVisit({
      sessionId: "session_1",
      funnelId: "funnel_1",
      funnelStepId: "step_1",
      contactId: "contact_1",
      referrer: "https://google.com",
      utmSource: "google",
      utmMedium: undefined,
      utmCampaign: null,
    });

    expect(prisma.funnelVisit.create).toHaveBeenCalledWith({
      data: {
        sessionId: "session_1",
        funnelId: "funnel_1",
        funnelStepId: "step_1",
        contactId: "contact_1",
        referrer: "https://google.com",
        utmSource: "google",
        utmMedium: undefined,
        utmCampaign: undefined,
      },
    });
  });
});

describe("getFunnelAnalytics", () => {
  it("computes per-step visits, unique visitors, submissions, and step-to-step conversion", async () => {
    vi.mocked(prisma.funnelStep.findMany).mockResolvedValue([
      { id: "step_1", name: "Landing", slug: "landing", order: 0 },
      { id: "step_2", name: "Offer", slug: "offer", order: 1 },
    ] as never);

    // step_1: 3 unique sessions (a, b, c); step_2: 2 unique sessions (a, b) —
    // both of which also visited step_1, so conversion should be 2/3.
    vi.mocked(prisma.funnelVisit.findMany)
      .mockResolvedValueOnce([{ sessionId: "a" }, { sessionId: "b" }, { sessionId: "c" }] as never)
      .mockResolvedValueOnce([{ sessionId: "a" }, { sessionId: "b" }] as never);
    vi.mocked(prisma.funnelVisit.count).mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    vi.mocked(prisma.funnelSubmission.count).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    vi.mocked(prisma.funnelSubmission.findMany).mockResolvedValue([{ contactId: "contact_1" }] as never);
    vi.mocked(prisma.order.aggregate).mockResolvedValue({
      _count: { _all: 1 },
      _sum: { amountCents: 5000 },
    } as never);

    const result = await getFunnelAnalytics("funnel_1");

    expect(result.steps).toEqual([
      {
        stepId: "step_1",
        name: "Landing",
        slug: "landing",
        order: 0,
        totalVisits: 5,
        uniqueVisitors: 3,
        submissions: 1,
        conversionToNext: 2 / 3,
      },
      {
        stepId: "step_2",
        name: "Offer",
        slug: "offer",
        order: 1,
        totalVisits: 2,
        uniqueVisitors: 2,
        submissions: 0,
        conversionToNext: null,
      },
    ]);
    expect(result.totalLeads).toBe(1);
    expect(result.paidOrders).toBe(1);
    expect(result.revenueCents).toBe(5000);
    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { funnelId: "funnel_1", status: "PAID" } }),
    );
  });

  it("reports zero conversion (not NaN) from a step with no visitors", async () => {
    vi.mocked(prisma.funnelStep.findMany).mockResolvedValue([
      { id: "step_1", name: "Landing", slug: "landing", order: 0 },
      { id: "step_2", name: "Offer", slug: "offer", order: 1 },
    ] as never);
    vi.mocked(prisma.funnelVisit.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.funnelVisit.count).mockResolvedValue(0);
    vi.mocked(prisma.funnelSubmission.count).mockResolvedValue(0);
    vi.mocked(prisma.funnelSubmission.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.order.aggregate).mockResolvedValue({
      _count: { _all: 0 },
      _sum: { amountCents: null },
    } as never);

    const result = await getFunnelAnalytics("funnel_1");

    expect(result.steps[0].conversionToNext).toBe(0);
    expect(result.revenueCents).toBe(0);
  });
});
