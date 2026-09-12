import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { MessageChannel } from "@platform/db";

// Producer-only, same pattern as the other lib/queues/*.ts files — the
// worker (apps/worker/src/queues/manual-message.ts) owns the consumer.
let queue: Queue | undefined;
function getQueue(): Queue {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    queue = new Queue("manual-message", { connection });
  }
  return queue;
}

export interface EnqueueManualMessageInput {
  contactId: string;
  channel: MessageChannel;
  to: string;
  subject?: string;
  body: string;
}

export async function enqueueManualMessage(input: EnqueueManualMessageInput) {
  await getQueue().add("send", input);
}
