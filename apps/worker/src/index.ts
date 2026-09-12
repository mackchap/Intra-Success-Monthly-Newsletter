import { prisma } from "@platform/db";
import { createSequenceStepWorker } from "./queues/sequences";
import { createSequenceTriggerWorker } from "./queues/sequence-triggers";
import { createLeadQualificationWorker } from "./queues/lead-qualification";
import { createManualMessageWorker } from "./queues/manual-message";

const sequenceStepWorker = createSequenceStepWorker();
const sequenceTriggerWorker = createSequenceTriggerWorker();
const leadQualificationWorker = createLeadQualificationWorker();
const manualMessageWorker = createManualMessageWorker();

for (const [name, worker] of [
  ["sequence-steps", sequenceStepWorker],
  ["sequence-triggers", sequenceTriggerWorker],
  ["lead-qualification", leadQualificationWorker],
  ["manual-message", manualMessageWorker],
] as const) {
  worker.on("ready", () => console.log(`Worker connected to Redis, listening on queue: ${name}`));
  worker.on("failed", (job, err) => console.error(`[${name}] job ${job?.id} failed:`, err));
}

async function shutdown() {
  console.log("Shutting down worker...");
  await Promise.all([
    sequenceStepWorker.close(),
    sequenceTriggerWorker.close(),
    leadQualificationWorker.close(),
    manualMessageWorker.close(),
  ]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
