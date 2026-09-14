import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      contact: { findUnique: vi.fn(), upsert: vi.fn() },
      funnelSubmission: { create: vi.fn() },
      deal: { findFirst: vi.fn(), create: vi.fn() },
      pipeline: { findFirstOrThrow: vi.fn() },
      funnel: { findUniqueOrThrow: vi.fn() },
      activity: { create: vi.fn() },
    },
  };
});

vi.mock("@/lib/queues/sequence-triggers", () => ({
  enqueueFunnelSubmissionTrigger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/queues/lead-qualification", () => ({
  enqueueLeadQualification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/accounts/legacy-tenant", () => ({
  getLegacyTenantId: vi.fn().mockResolvedValue("tenant-1"),
}));

import { prisma } from "@platform/db";
import { enqueueFunnelSubmissionTrigger } from "@/lib/queues/sequence-triggers";
import { enqueueLeadQualification } from "@/lib/queues/lead-qualification";
import { captureLead } from "./leads";
import { ValidationError } from "@/lib/crm/errors";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("captureLead", () => {
  it("rejects a submission with no email", async () => {
    await expect(
      captureLead({ funnelId: "funnel_1", funnelStepId: "step_1", data: { firstName: "Jane" } }),
    ).rejects.toThrow(ValidationError);
    expect(prisma.contact.upsert).not.toHaveBeenCalled();
  });

  it("creates a contact, logs the submission, creates a deal, and qualifies the new lead", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.contact.upsert).mockResolvedValue({ id: "contact_1", email: "lead@example.com" } as never);
    vi.mocked(prisma.deal.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.pipeline.findFirstOrThrow).mockResolvedValue({
      id: "pipeline_1",
      stages: [{ id: "stage_lead" }],
    } as never);
    vi.mocked(prisma.funnel.findUniqueOrThrow).mockResolvedValue({ id: "funnel_1", name: "Webinar Funnel" } as never);
    vi.mocked(prisma.deal.create).mockResolvedValue({ id: "deal_1" } as never);

    const result = await captureLead({
      funnelId: "funnel_1",
      funnelStepId: "step_1",
      data: { email: "lead@example.com", firstName: "Jane" },
    });

    expect(prisma.funnelSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactId: "contact_1" }) }),
    );
    expect(prisma.deal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: "contact_1", funnelId: "funnel_1", stageId: "stage_lead" }),
      }),
    );
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "FUNNEL_SUBMISSION", contactId: "contact_1", dealId: "deal_1" }),
    });
    expect(result).toEqual({ contact: { id: "contact_1", email: "lead@example.com" }, deal: { id: "deal_1" } });
    expect(enqueueFunnelSubmissionTrigger).toHaveBeenCalledWith("funnel_1", "contact_1");
    expect(enqueueLeadQualification).toHaveBeenCalledWith("contact_1");
  });

  it("reuses the existing deal instead of creating a second one for a repeat opt-in, and does not re-qualify it", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue({ id: "contact_1", email: "lead@example.com" } as never);
    vi.mocked(prisma.contact.upsert).mockResolvedValue({ id: "contact_1", email: "lead@example.com" } as never);
    vi.mocked(prisma.deal.findFirst).mockResolvedValue({ id: "deal_existing" } as never);

    const result = await captureLead({
      funnelId: "funnel_1",
      funnelStepId: "step_2",
      data: { email: "lead@example.com" },
    });

    expect(prisma.deal.create).not.toHaveBeenCalled();
    expect(prisma.pipeline.findFirstOrThrow).not.toHaveBeenCalled();
    expect(result.deal).toEqual({ id: "deal_existing" });
    expect(enqueueLeadQualification).not.toHaveBeenCalled();
  });
});
