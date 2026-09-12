import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  Worker: vi.fn(),
}));

vi.mock("../agents/lead-qualification", () => ({
  qualifyLead: vi.fn(),
}));

import { qualifyLead } from "../agents/lead-qualification";
import { enqueueLeadQualification, leadQualificationQueue, processLeadQualificationJob } from "./lead-qualification";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enqueueLeadQualification", () => {
  it("adds a qualify job with the contact id", async () => {
    await enqueueLeadQualification("contact_1");
    expect(leadQualificationQueue.add).toHaveBeenCalledWith("qualify", { contactId: "contact_1" });
  });
});

describe("processLeadQualificationJob", () => {
  it("delegates to qualifyLead", async () => {
    await processLeadQualificationJob({ contactId: "contact_1" });
    expect(qualifyLead).toHaveBeenCalledWith("contact_1");
  });
});
