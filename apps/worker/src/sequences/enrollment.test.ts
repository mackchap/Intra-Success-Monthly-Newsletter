import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      sequenceEnrollment: { findUnique: vi.fn(), create: vi.fn() },
      sequenceStep: { findFirst: vi.fn() },
    },
  };
});

vi.mock("../queues/sequences", () => ({
  enqueueSequenceStepJob: vi.fn(),
}));

import { prisma } from "@platform/db";
import { enqueueSequenceStepJob } from "../queues/sequences";
import { enrollContactInSequence } from "./enrollment";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enrollContactInSequence", () => {
  it("returns the existing enrollment instead of creating a duplicate", async () => {
    vi.mocked(prisma.sequenceEnrollment.findUnique).mockResolvedValue({ id: "existing" } as never);

    const result = await enrollContactInSequence("sequence_1", "contact_1");

    expect(result).toEqual({ id: "existing" });
    expect(prisma.sequenceEnrollment.create).not.toHaveBeenCalled();
    expect(enqueueSequenceStepJob).not.toHaveBeenCalled();
  });

  it("returns null for a sequence with no steps configured", async () => {
    vi.mocked(prisma.sequenceEnrollment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.sequenceStep.findFirst).mockResolvedValue(null);

    const result = await enrollContactInSequence("sequence_1", "contact_1");

    expect(result).toBeNull();
    expect(prisma.sequenceEnrollment.create).not.toHaveBeenCalled();
  });

  it("creates the enrollment and enqueues the first step's job", async () => {
    vi.mocked(prisma.sequenceEnrollment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.sequenceStep.findFirst).mockResolvedValue({ order: 0, delayMinutes: 15 } as never);
    vi.mocked(prisma.sequenceEnrollment.create).mockResolvedValue({ id: "new_enrollment" } as never);

    const result = await enrollContactInSequence("sequence_1", "contact_1");

    expect(prisma.sequenceEnrollment.create).toHaveBeenCalledWith({
      data: { sequenceId: "sequence_1", contactId: "contact_1", status: "ACTIVE", currentStepOrder: 0 },
    });
    expect(enqueueSequenceStepJob).toHaveBeenCalledWith({ enrollmentId: "new_enrollment", stepOrder: 0 }, 15);
    expect(result).toEqual({ id: "new_enrollment" });
  });
});
