import { Queue } from "bullmq";
import IORedis from "ioredis";

// The web app is only a *producer* onto this queue — apps/worker owns the
// consumer (apps/worker/src/queues/sequence-triggers.ts) and the actual
// sequence-enrollment logic, per CLAUDE.md: background work never runs
// inside the web process. Constructed lazily (not at module import time)
// so a missing REDIS_URL doesn't affect anything until a trigger actually
// fires — `lazyConnect` means the underlying TCP connection isn't even
// attempted until the first `.add()` call.
let queue: Queue | undefined;
function getQueue(): Queue {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    queue = new Queue("sequence-triggers", { connection });
  }
  return queue;
}

export async function enqueueFunnelSubmissionTrigger(funnelId: string, contactId: string) {
  await getQueue().add("funnel-submission", { type: "funnel-submission", funnelId, contactId });
}

export async function enqueueAbandonedCheckoutCheck(orderId: string, delayMinutes: number) {
  await getQueue().add(
    "abandoned-checkout",
    { type: "abandoned-checkout", orderId },
    { delay: delayMinutes * 60 * 1000 },
  );
}
