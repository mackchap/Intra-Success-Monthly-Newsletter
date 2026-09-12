import { Queue } from "bullmq";
import IORedis from "ioredis";

// Producer-only, same pattern as lib/queues/sequence-triggers.ts — the
// worker (apps/worker/src/queues/lead-qualification.ts) owns the consumer
// and the actual agent call.
let queue: Queue | undefined;
function getQueue(): Queue {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    queue = new Queue("lead-qualification", { connection });
  }
  return queue;
}

export async function enqueueLeadQualification(contactId: string) {
  await getQueue().add("qualify", { contactId });
}
