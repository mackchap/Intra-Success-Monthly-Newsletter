import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma, SequenceEnrollmentStatus, MessageChannel } from "@platform/db";
import { sendSequenceMessage } from "../messaging/send";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const sequenceStepQueue = new Queue("sequence-steps", { connection });

export interface SequenceStepJobData {
  enrollmentId: string;
  stepOrder: number;
}

export async function enqueueSequenceStepJob(data: SequenceStepJobData, delayMinutes: number) {
  await sequenceStepQueue.add("send-step", data, { delay: delayMinutes * 60 * 1000 });
}

// Exported standalone (not inlined in the Worker callback) so it's
// unit-testable without spinning up a real BullMQ Worker/Redis connection.
// One job per step, delayed by that step's delayMinutes; on completion it
// enqueues the next step's job (or marks the enrollment COMPLETED) — the
// queue itself is the state machine, not a single long-running job.
export async function processSequenceStepJob(data: SequenceStepJobData) {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: data.enrollmentId },
    include: { contact: true, sequence: { include: { steps: { orderBy: { order: "asc" } } } } },
  });
  if (!enrollment || enrollment.status !== SequenceEnrollmentStatus.ACTIVE) {
    return; // canceled/completed since this job was scheduled
  }

  const step = enrollment.sequence.steps.find((s) => s.order === data.stepOrder);
  if (!step) return;

  const to = step.channel === MessageChannel.EMAIL ? enrollment.contact.email : enrollment.contact.phone;
  if (!to) {
    console.warn(
      `Contact ${enrollment.contactId} has no ${step.channel} address on file; skipping sequence step ${step.id}`,
    );
  } else {
    await sendSequenceMessage({
      contactId: enrollment.contactId,
      sequenceStepId: step.id,
      channel: step.channel,
      to,
      subject: step.subject ?? undefined,
      body: step.body,
    });
  }

  const nextStep = enrollment.sequence.steps.find((s) => s.order === step.order + 1);
  if (nextStep) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { currentStepOrder: nextStep.order },
    });
    await enqueueSequenceStepJob({ enrollmentId: enrollment.id, stepOrder: nextStep.order }, nextStep.delayMinutes);
  } else {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: SequenceEnrollmentStatus.COMPLETED, completedAt: new Date() },
    });
  }
}

export function createSequenceStepWorker() {
  return new Worker<SequenceStepJobData>(
    "sequence-steps",
    (job: Job<SequenceStepJobData>) => processSequenceStepJob(job.data),
    { connection },
  );
}
