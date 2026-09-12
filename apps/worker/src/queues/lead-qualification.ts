import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { qualifyLead } from "../agents/lead-qualification";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const leadQualificationQueue = new Queue("lead-qualification", { connection });

export interface LeadQualificationJobData {
  contactId: string;
}

export async function enqueueLeadQualification(contactId: string) {
  await leadQualificationQueue.add("qualify", { contactId });
}

// Exported standalone (same rationale as processSequenceStepJob) so it's
// unit-testable without a real BullMQ Worker/Redis connection.
export async function processLeadQualificationJob(data: LeadQualificationJobData) {
  await qualifyLead(data.contactId);
}

export function createLeadQualificationWorker() {
  return new Worker<LeadQualificationJobData>(
    "lead-qualification",
    (job: Job<LeadQualificationJobData>) => processLeadQualificationJob(job.data),
    { connection },
  );
}
