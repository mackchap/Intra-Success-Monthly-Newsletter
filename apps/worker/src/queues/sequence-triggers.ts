import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma, OrderStatus, SequenceTrigger } from "@platform/db";
import { enrollContactInSequence } from "../sequences/enrollment";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const sequenceTriggerQueue = new Queue("sequence-triggers", { connection });

export type SequenceTriggerJobData =
  | { type: "funnel-submission"; funnelId: string; contactId: string }
  | { type: "abandoned-checkout"; orderId: string };

export async function enqueueFunnelSubmissionTrigger(funnelId: string, contactId: string) {
  await sequenceTriggerQueue.add("funnel-submission", { type: "funnel-submission", funnelId, contactId });
}

export async function enqueueAbandonedCheckoutCheck(orderId: string, delayMinutes: number) {
  await sequenceTriggerQueue.add(
    "abandoned-checkout",
    { type: "abandoned-checkout", orderId },
    { delay: delayMinutes * 60 * 1000 },
  );
}

// Exported standalone for the same reason as processSequenceStepJob: unit
// testable without a real Worker/Redis connection.
export async function processSequenceTriggerJob(data: SequenceTriggerJobData) {
  if (data.type === "funnel-submission") {
    // "Funnel stage entered" (any step's opt-in) and a dedicated WELCOME
    // sequence are treated the same here — the schema doesn't attach a
    // trigger to a specific FunnelStep, only to the Funnel as a whole, so
    // there's no meaningful distinction to make between the two triggers
    // at this granularity.
    const sequences = await prisma.sequence.findMany({
      where: {
        funnelId: data.funnelId,
        active: true,
        trigger: { in: [SequenceTrigger.WELCOME, SequenceTrigger.FUNNEL_STAGE_ENTERED] },
      },
    });
    for (const sequence of sequences) {
      await enrollContactInSequence(sequence.id, data.contactId);
    }
    return;
  }

  // abandoned-checkout: only enroll if the order is still unpaid by the
  // time this delayed job fires — a completed purchase in the meantime
  // means there's nothing to "abandon."
  const order = await prisma.order.findUnique({ where: { id: data.orderId } });
  if (!order || order.status !== OrderStatus.PENDING) return;
  if (!order.funnelId || !order.contactId) return;

  const sequences = await prisma.sequence.findMany({
    where: { funnelId: order.funnelId, active: true, trigger: SequenceTrigger.ABANDONED_CHECKOUT },
  });
  for (const sequence of sequences) {
    await enrollContactInSequence(sequence.id, order.contactId);
  }
}

export function createSequenceTriggerWorker() {
  return new Worker<SequenceTriggerJobData>(
    "sequence-triggers",
    (job: Job<SequenceTriggerJobData>) => processSequenceTriggerJob(job.data),
    { connection },
  );
}
