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
      activity: { create: vi.fn() },
    },
  };
});

vi.mock("../messaging/send", () => ({
  sendSequenceMessage: vi.fn(),
}));

import { prisma } from "@platform/db";
import { sendSequenceMessage } from "../messaging/send";
import { enqueueManualMessage, manualMessageQueue, processManualMessageJob } from "./manual-message";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enqueueManualMessage", () => {
  it("adds a send job with the given data", async () => {
    await enqueueManualMessage({ contactId: "contact_1", channel: "EMAIL", to: "a@example.com", subject: "Hi", body: "Hello" });
    expect(manualMessageQueue.add).toHaveBeenCalledWith("send", {
      contactId: "contact_1",
      channel: "EMAIL",
      to: "a@example.com",
      subject: "Hi",
      body: "Hello",
    });
  });
});

describe("processManualMessageJob", () => {
  it("sends the message (no sequenceStepId) and logs an EMAIL_SENT activity", async () => {
    await processManualMessageJob({ contactId: "contact_1", channel: "EMAIL", to: "a@example.com", subject: "Hi", body: "Hello" });

    expect(sendSequenceMessage).toHaveBeenCalledWith({
      contactId: "contact_1",
      channel: "EMAIL",
      to: "a@example.com",
      subject: "Hi",
      body: "Hello",
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { type: "EMAIL_SENT", contactId: "contact_1", metadata: { subject: "Hi" } },
    });
  });

  it("logs SMS_SENT for the SMS channel", async () => {
    await processManualMessageJob({ contactId: "contact_1", channel: "SMS", to: "+15555550100", body: "Hello" });

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { type: "SMS_SENT", contactId: "contact_1", metadata: { subject: undefined } },
    });
  });

  it("does not log an activity if the send fails", async () => {
    vi.mocked(sendSequenceMessage).mockRejectedValue(new Error("Provider down"));

    await expect(
      processManualMessageJob({ contactId: "contact_1", channel: "EMAIL", to: "a@example.com", body: "Hello" }),
    ).rejects.toThrow("Provider down");

    expect(prisma.activity.create).not.toHaveBeenCalled();
  });
});
