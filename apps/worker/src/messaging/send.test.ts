import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      messageLog: { create: vi.fn(), update: vi.fn() },
    },
  };
});

vi.mock("./providers", () => ({
  getEmailProvider: vi.fn(),
  getSmsProvider: vi.fn(),
}));

import { prisma } from "@platform/db";
import { getEmailProvider, getSmsProvider } from "./providers";
import { sendSequenceMessage } from "./send";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendSequenceMessage", () => {
  it("logs QUEUED then SENT on success, via the email provider for EMAIL channel", async () => {
    vi.mocked(prisma.messageLog.create).mockResolvedValue({ id: "log_1" } as never);
    const send = vi.fn().mockResolvedValue({ providerMessageId: "resend_123" });
    vi.mocked(getEmailProvider).mockReturnValue({ send });

    await sendSequenceMessage({
      contactId: "contact_1",
      sequenceStepId: "step_1",
      channel: "EMAIL",
      to: "lead@example.com",
      subject: "Welcome",
      body: "Hi there",
    });

    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: "EMAIL", provider: "resend", status: "QUEUED" }),
    });
    expect(send).toHaveBeenCalledWith({ to: "lead@example.com", subject: "Welcome", body: "Hi there" });
    expect(prisma.messageLog.update).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: { status: "SENT", providerMessageId: "resend_123", sentAt: expect.any(Date) },
    });
    expect(getSmsProvider).not.toHaveBeenCalled();
  });

  it("uses the SMS provider for SMS channel", async () => {
    vi.mocked(prisma.messageLog.create).mockResolvedValue({ id: "log_2" } as never);
    const send = vi.fn().mockResolvedValue({ providerMessageId: "twilio_123" });
    vi.mocked(getSmsProvider).mockReturnValue({ send });

    await sendSequenceMessage({
      contactId: "contact_1",
      sequenceStepId: "step_2",
      channel: "SMS",
      to: "+15555550100",
      body: "Hi there",
    });

    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: "SMS", provider: "twilio" }),
    });
    expect(send).toHaveBeenCalledWith({ to: "+15555550100", body: "Hi there" });
    expect(getEmailProvider).not.toHaveBeenCalled();
  });

  it("logs FAILED and rethrows when the provider throws", async () => {
    vi.mocked(prisma.messageLog.create).mockResolvedValue({ id: "log_3" } as never);
    const send = vi.fn().mockRejectedValue(new Error("RESEND_API_KEY is not set."));
    vi.mocked(getEmailProvider).mockReturnValue({ send });

    await expect(
      sendSequenceMessage({
        contactId: "contact_1",
        sequenceStepId: "step_1",
        channel: "EMAIL",
        to: "lead@example.com",
        subject: "Welcome",
        body: "Hi",
      }),
    ).rejects.toThrow("RESEND_API_KEY is not set.");

    expect(prisma.messageLog.update).toHaveBeenCalledWith({
      where: { id: "log_3" },
      data: { status: "FAILED", error: "RESEND_API_KEY is not set." },
    });
  });
});
