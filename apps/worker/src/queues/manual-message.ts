import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma, ActivityType, MessageChannel } from "@platform/db";
import { sendSequenceMessage } from "../messaging/send";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const manualMessageQueue = new Queue("manual-message", { connection });

export interface ManualMessageJobData {
  contactId: string;
  channel: MessageChannel;
  to: string;
  subject?: string;
  body: string;
}

export async function enqueueManualMessage(data: ManualMessageJobData) {
  await manualMessageQueue.add("send", data);
}

// Exported standalone (same rationale as processSequenceStepJob). Unlike
// automated sequence sends (no Activity logged — see sequences.ts), a
// manual send is a staff-initiated, timeline-worthy contact action, so it
// also logs an EMAIL_SENT/SMS_SENT Activity.
export async function processManualMessageJob(data: ManualMessageJobData) {
  await sendSequenceMessage({
    contactId: data.contactId,
    channel: data.channel,
    to: data.to,
    subject: data.subject,
    body: data.body,
  });

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: data.contactId } });

  await prisma.activity.create({
    data: {
      tenantId: contact.tenantId,
      type: data.channel === MessageChannel.EMAIL ? ActivityType.EMAIL_SENT : ActivityType.SMS_SENT,
      contactId: data.contactId,
      metadata: { subject: data.subject },
    },
  });
}

export function createManualMessageWorker() {
  return new Worker<ManualMessageJobData>(
    "manual-message",
    (job: Job<ManualMessageJobData>) => processManualMessageJob(job.data),
    { connection },
  );
}
