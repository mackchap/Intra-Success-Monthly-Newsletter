import { prisma, ActivityType, DealStatus } from "@platform/db";
import { ValidationError } from "./errors";

export interface CreateDealInput {
  title: string;
  contactId: string;
  companyId?: string;
  ownerId?: string;
  pipelineId: string;
  stageId: string;
  valueCents?: number;
  currency?: string;
  funnelId?: string;
  actorId: string;
}

export async function createDeal(input: CreateDealInput) {
  const deal = await prisma.deal.create({
    data: {
      title: input.title,
      contactId: input.contactId,
      companyId: input.companyId,
      ownerId: input.ownerId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      valueCents: input.valueCents ?? 0,
      currency: input.currency ?? "usd",
      funnelId: input.funnelId,
    },
  });

  await prisma.activity.create({
    data: {
      type: ActivityType.DEAL_CREATED,
      actorId: input.actorId,
      contactId: deal.contactId,
      dealId: deal.id,
      metadata: { title: deal.title, valueCents: deal.valueCents },
    },
  });

  return deal;
}

// Moves a deal to a different pipeline stage. If the destination stage is
// marked isWon/isLost, this also closes the deal (status + closedAt) and
// logs a DEAL_WON/DEAL_LOST activity instead of a plain STAGE_CHANGED one,
// so the timeline reads "won" rather than "moved to stage: Won".
// `actorId` is omitted for system-triggered moves (e.g. a Stripe webhook
// closing a deal on payment) — Activity.actorId is nullable for exactly this.
export async function moveDealStage(dealId: string, newStageId: string, actorId?: string) {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });

  if (deal.status !== DealStatus.OPEN) {
    throw new ValidationError("Cannot move a closed deal to a different stage.");
  }

  const newStage = await prisma.pipelineStage.findUniqueOrThrow({ where: { id: newStageId } });

  const fromStageId = deal.stageId;
  const isClosing = newStage.isWon || newStage.isLost;

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      stageId: newStageId,
      ...(isClosing
        ? {
            status: newStage.isWon ? DealStatus.WON : DealStatus.LOST,
            closedAt: new Date(),
          }
        : {}),
    },
  });

  await prisma.activity.create({
    data: {
      type: newStage.isWon
        ? ActivityType.DEAL_WON
        : newStage.isLost
          ? ActivityType.DEAL_LOST
          : ActivityType.STAGE_CHANGED,
      actorId,
      dealId,
      contactId: deal.contactId,
      metadata: { fromStageId, toStageId: newStageId, stageName: newStage.name },
    },
  });

  return updated;
}
