import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      deal: { findUniqueOrThrow: vi.fn(), update: vi.fn(), create: vi.fn() },
      pipelineStage: { findUniqueOrThrow: vi.fn() },
      activity: { create: vi.fn() },
    },
  };
});

import { prisma, DealStatus } from "@platform/db";
import { createDeal, moveDealStage } from "./deals";
import { ValidationError } from "./errors";

describe("moveDealStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves an open deal to a regular stage and logs STAGE_CHANGED", async () => {
    vi.mocked(prisma.deal.findUniqueOrThrow).mockResolvedValue({
      id: "deal-1",
      tenantId: "tenant-1",
      status: DealStatus.OPEN,
      stageId: "stage-lead",
      contactId: "contact-1",
    } as never);
    vi.mocked(prisma.pipelineStage.findUniqueOrThrow).mockResolvedValue({
      id: "stage-qualified",
      name: "Qualified",
      isWon: false,
      isLost: false,
    } as never);
    vi.mocked(prisma.deal.update).mockResolvedValue({ id: "deal-1", status: DealStatus.OPEN } as never);

    await moveDealStage("deal-1", "stage-qualified", "user-1");

    expect(prisma.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: { stageId: "stage-qualified" },
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "STAGE_CHANGED",
        dealId: "deal-1",
        contactId: "contact-1",
        metadata: { fromStageId: "stage-lead", toStageId: "stage-qualified", stageName: "Qualified" },
      }),
    });
  });

  it("closes the deal as WON and logs DEAL_WON when moved into a won stage", async () => {
    vi.mocked(prisma.deal.findUniqueOrThrow).mockResolvedValue({
      id: "deal-1",
      tenantId: "tenant-1",
      status: DealStatus.OPEN,
      stageId: "stage-negotiation",
      contactId: "contact-1",
    } as never);
    vi.mocked(prisma.pipelineStage.findUniqueOrThrow).mockResolvedValue({
      id: "stage-won",
      name: "Won",
      isWon: true,
      isLost: false,
    } as never);
    vi.mocked(prisma.deal.update).mockResolvedValue({ id: "deal-1", status: DealStatus.WON } as never);

    await moveDealStage("deal-1", "stage-won", "user-1");

    expect(prisma.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: expect.objectContaining({ stageId: "stage-won", status: DealStatus.WON, closedAt: expect.any(Date) }),
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DEAL_WON" }),
    });
  });

  it("closes the deal as LOST and logs DEAL_LOST when moved into a lost stage", async () => {
    vi.mocked(prisma.deal.findUniqueOrThrow).mockResolvedValue({
      id: "deal-1",
      tenantId: "tenant-1",
      status: DealStatus.OPEN,
      stageId: "stage-negotiation",
      contactId: "contact-1",
    } as never);
    vi.mocked(prisma.pipelineStage.findUniqueOrThrow).mockResolvedValue({
      id: "stage-lost",
      name: "Lost",
      isWon: false,
      isLost: true,
    } as never);
    vi.mocked(prisma.deal.update).mockResolvedValue({ id: "deal-1", status: DealStatus.LOST } as never);

    await moveDealStage("deal-1", "stage-lost", "user-1");

    expect(prisma.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: expect.objectContaining({ status: DealStatus.LOST, closedAt: expect.any(Date) }),
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DEAL_LOST" }),
    });
  });

  it("refuses to move a deal that is already closed", async () => {
    vi.mocked(prisma.deal.findUniqueOrThrow).mockResolvedValue({
      id: "deal-1",
      tenantId: "tenant-1",
      status: DealStatus.WON,
      stageId: "stage-won",
      contactId: "contact-1",
    } as never);

    await expect(moveDealStage("deal-1", "stage-lead", "user-1")).rejects.toThrow(ValidationError);
    expect(prisma.deal.update).not.toHaveBeenCalled();
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });
});

describe("createDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a deal and logs a DEAL_CREATED activity", async () => {
    vi.mocked(prisma.deal.create).mockResolvedValue({
      id: "deal-2",
      title: "New deal",
      contactId: "contact-1",
      valueCents: 5000,
    } as never);

    await createDeal({
      tenantId: "tenant-1",
      title: "New deal",
      contactId: "contact-1",
      pipelineId: "pipeline-1",
      stageId: "stage-lead",
      valueCents: 5000,
      actorId: "user-1",
    });

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DEAL_CREATED", dealId: "deal-2", contactId: "contact-1" }),
    });
  });
});
