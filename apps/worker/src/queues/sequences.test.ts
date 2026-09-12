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
      sequenceEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    },
  };
});

vi.mock("../messaging/send", () => ({
  sendSequenceMessage: vi.fn(),
}));

import { prisma } from "@platform/db";
import { sendSequenceMessage } from "../messaging/send";
import { processSequenceStepJob, sequenceStepQueue } from "./sequences";

function enrollmentFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "enrollment_1",
    status: "ACTIVE",
    contactId: "contact_1",
    contact: { email: "lead@example.com", phone: null },
    sequence: {
      steps: [
        { id: "step_0", order: 0, channel: "EMAIL", delayMinutes: 0, subject: "Welcome", body: "Hi" },
        { id: "step_1", order: 1, channel: "EMAIL", delayMinutes: 60, subject: "Follow up", body: "Still there?" },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processSequenceStepJob", () => {
  it("does nothing if the enrollment is missing or not ACTIVE", async () => {
    vi.mocked(prisma.sequenceEnrollment.findUnique).mockResolvedValue(null);

    await processSequenceStepJob({ enrollmentId: "missing", stepOrder: 0 });

    expect(sendSequenceMessage).not.toHaveBeenCalled();
  });

  it("sends the step's message and enqueues the next step", async () => {
    vi.mocked(prisma.sequenceEnrollment.findUnique).mockResolvedValue(enrollmentFixture() as never);

    await processSequenceStepJob({ enrollmentId: "enrollment_1", stepOrder: 0 });

    expect(sendSequenceMessage).toHaveBeenCalledWith({
      contactId: "contact_1",
      sequenceStepId: "step_0",
      channel: "EMAIL",
      to: "lead@example.com",
      subject: "Welcome",
      body: "Hi",
    });
    expect(prisma.sequenceEnrollment.update).toHaveBeenCalledWith({
      where: { id: "enrollment_1" },
      data: { currentStepOrder: 1 },
    });
    expect(sequenceStepQueue.add).toHaveBeenCalledWith(
      "send-step",
      { enrollmentId: "enrollment_1", stepOrder: 1 },
      { delay: 60 * 60 * 1000 },
    );
  });

  it("marks the enrollment COMPLETED after the last step", async () => {
    vi.mocked(prisma.sequenceEnrollment.findUnique).mockResolvedValue(enrollmentFixture() as never);

    await processSequenceStepJob({ enrollmentId: "enrollment_1", stepOrder: 1 });

    expect(prisma.sequenceEnrollment.update).toHaveBeenCalledWith({
      where: { id: "enrollment_1" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    expect(sequenceStepQueue.add).not.toHaveBeenCalled();
  });

  it("skips sending (but still advances) when the contact has no address for that channel", async () => {
    vi.mocked(prisma.sequenceEnrollment.findUnique).mockResolvedValue(
      enrollmentFixture({
        contact: { email: null, phone: null },
        sequence: {
          steps: [{ id: "step_0", order: 0, channel: "EMAIL", delayMinutes: 0, subject: "Hi", body: "Hi" }],
        },
      }) as never,
    );

    await processSequenceStepJob({ enrollmentId: "enrollment_1", stepOrder: 0 });

    expect(sendSequenceMessage).not.toHaveBeenCalled();
    expect(prisma.sequenceEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETED", completedAt: expect.any(Date) } }),
    );
  });
});
