import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  Worker: vi.fn(),
}));

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      sequence: { findMany: vi.fn() },
      order: { findUnique: vi.fn() },
    },
  };
});

vi.mock("../sequences/enrollment", () => ({
  enrollContactInSequence: vi.fn(),
}));

import { prisma } from "@platform/db";
import { enrollContactInSequence } from "../sequences/enrollment";
import { processSequenceTriggerJob } from "./sequence-triggers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processSequenceTriggerJob — funnel-submission", () => {
  it("enrolls the contact in every active WELCOME/FUNNEL_STAGE_ENTERED sequence for the funnel", async () => {
    vi.mocked(prisma.sequence.findMany).mockResolvedValue([{ id: "seq_1" }, { id: "seq_2" }] as never);

    await processSequenceTriggerJob({ type: "funnel-submission", funnelId: "funnel_1", contactId: "contact_1" });

    expect(prisma.sequence.findMany).toHaveBeenCalledWith({
      where: { funnelId: "funnel_1", active: true, trigger: { in: ["WELCOME", "FUNNEL_STAGE_ENTERED"] } },
    });
    expect(enrollContactInSequence).toHaveBeenCalledWith("seq_1", "contact_1");
    expect(enrollContactInSequence).toHaveBeenCalledWith("seq_2", "contact_1");
  });
});

describe("processSequenceTriggerJob — abandoned-checkout", () => {
  it("does nothing if the order is no longer PENDING", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ status: "PAID" } as never);

    await processSequenceTriggerJob({ type: "abandoned-checkout", orderId: "order_1" });

    expect(prisma.sequence.findMany).not.toHaveBeenCalled();
  });

  it("does nothing if the order has no funnel/contact linkage", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({ status: "PENDING", funnelId: null, contactId: "c1" } as never);

    await processSequenceTriggerJob({ type: "abandoned-checkout", orderId: "order_1" });

    expect(prisma.sequence.findMany).not.toHaveBeenCalled();
  });

  it("enrolls the order's contact in the funnel's ABANDONED_CHECKOUT sequence when still pending", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      status: "PENDING",
      funnelId: "funnel_1",
      contactId: "contact_1",
    } as never);
    vi.mocked(prisma.sequence.findMany).mockResolvedValue([{ id: "seq_abandoned" }] as never);

    await processSequenceTriggerJob({ type: "abandoned-checkout", orderId: "order_1" });

    expect(prisma.sequence.findMany).toHaveBeenCalledWith({
      where: { funnelId: "funnel_1", active: true, trigger: "ABANDONED_CHECKOUT" },
    });
    expect(enrollContactInSequence).toHaveBeenCalledWith("seq_abandoned", "contact_1");
  });
});
