import { prisma, OrderStatus } from "@platform/db";

export interface LogFunnelVisitInput {
  sessionId: string;
  funnelId: string;
  funnelStepId: string;
  contactId?: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

// One row per page view (see the FunnelVisit schema comment) — no
// dedupe/upsert, this is a raw event log, same as GA pageviews.
export async function logFunnelVisit(input: LogFunnelVisitInput) {
  return prisma.funnelVisit.create({
    data: {
      sessionId: input.sessionId,
      funnelId: input.funnelId,
      funnelStepId: input.funnelStepId,
      contactId: input.contactId,
      referrer: input.referrer ?? undefined,
      utmSource: input.utmSource ?? undefined,
      utmMedium: input.utmMedium ?? undefined,
      utmCampaign: input.utmCampaign ?? undefined,
    },
  });
}

export interface FunnelStepAnalytics {
  stepId: string;
  name: string;
  slug: string;
  order: number;
  totalVisits: number;
  uniqueVisitors: number;
  submissions: number;
  // Unique visitors on this step who also visited the next step, divided by
  // this step's unique visitors. null on the last step (nothing to convert into).
  conversionToNext: number | null;
}

export interface FunnelAnalytics {
  funnelId: string;
  steps: FunnelStepAnalytics[];
  totalLeads: number;
  paidOrders: number;
  revenueCents: number;
}

export async function getFunnelAnalytics(funnelId: string): Promise<FunnelAnalytics> {
  const steps = await prisma.funnelStep.findMany({
    where: { funnelId },
    orderBy: { order: "asc" },
  });

  const stepSessionSets = await Promise.all(
    steps.map((step) =>
      prisma.funnelVisit.findMany({
        where: { funnelStepId: step.id },
        select: { sessionId: true },
        distinct: ["sessionId"],
      }),
    ),
  );

  const [visitCounts, submissionCounts, totalLeads, orderTotals] = await Promise.all([
    Promise.all(steps.map((step) => prisma.funnelVisit.count({ where: { funnelStepId: step.id } }))),
    Promise.all(steps.map((step) => prisma.funnelSubmission.count({ where: { funnelStepId: step.id } }))),
    prisma.funnelSubmission.findMany({ where: { funnelId }, select: { contactId: true }, distinct: ["contactId"] }),
    prisma.order.aggregate({
      where: { funnelId, status: OrderStatus.PAID },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
  ]);

  const stepAnalytics: FunnelStepAnalytics[] = steps.map((step, index) => {
    const uniqueSessions = new Set(stepSessionSets[index].map((v) => v.sessionId));
    const nextUniqueSessions =
      index + 1 < steps.length ? new Set(stepSessionSets[index + 1].map((v) => v.sessionId)) : null;

    let conversionToNext: number | null = null;
    if (nextUniqueSessions) {
      const carriedForward = [...uniqueSessions].filter((sessionId) => nextUniqueSessions.has(sessionId)).length;
      conversionToNext = uniqueSessions.size === 0 ? 0 : carriedForward / uniqueSessions.size;
    }

    return {
      stepId: step.id,
      name: step.name,
      slug: step.slug,
      order: step.order,
      totalVisits: visitCounts[index],
      uniqueVisitors: uniqueSessions.size,
      submissions: submissionCounts[index],
      conversionToNext,
    };
  });

  return {
    funnelId,
    steps: stepAnalytics,
    totalLeads: totalLeads.length,
    paidOrders: orderTotals._count._all,
    revenueCents: orderTotals._sum.amountCents ?? 0,
  };
}
