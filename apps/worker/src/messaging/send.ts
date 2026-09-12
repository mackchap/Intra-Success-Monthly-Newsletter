import { prisma, MessageChannel, MessageStatus } from "@platform/db";
import { getEmailProvider, getSmsProvider } from "./providers";

export interface SendSequenceMessageInput {
  contactId: string;
  // Omitted for a one-off, non-sequence send (e.g. a staff-reviewed
  // follow-up-agent email) — MessageLog.sequenceStepId is nullable for
  // exactly this reason.
  sequenceStepId?: string;
  channel: MessageChannel;
  to: string;
  subject?: string;
  body: string;
}

// Always writes a MessageLog row — QUEUED first, then SENT/FAILED — so a
// send attempt is recorded even if the provider call throws. Channel
// selects the provider; sequence-processing code never talks to
// Resend/Twilio directly.
export async function sendSequenceMessage(input: SendSequenceMessageInput) {
  const log = await prisma.messageLog.create({
    data: {
      contactId: input.contactId,
      sequenceStepId: input.sequenceStepId,
      channel: input.channel,
      provider: input.channel === MessageChannel.EMAIL ? "resend" : "twilio",
      status: MessageStatus.QUEUED,
    },
  });

  try {
    const result =
      input.channel === MessageChannel.EMAIL
        ? await getEmailProvider().send({ to: input.to, subject: input.subject ?? "", body: input.body })
        : await getSmsProvider().send({ to: input.to, body: input.body });

    await prisma.messageLog.update({
      where: { id: log.id },
      data: { status: MessageStatus.SENT, providerMessageId: result.providerMessageId, sentAt: new Date() },
    });
  } catch (error) {
    await prisma.messageLog.update({
      where: { id: log.id },
      data: { status: MessageStatus.FAILED, error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
