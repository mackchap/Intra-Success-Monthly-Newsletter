import { Queue } from "bullmq";
import IORedis from "ioredis";

// Producer-only, same pattern as the other lib/queues/*.ts files — the
// worker (apps/worker/src/queues/social-posts.ts) owns the consumer and the
// actual Meta Graph API call. Publishing is never done in the web request
// cycle, immediate or scheduled alike — only the delay differs.
let queue: Queue | undefined;
function getQueue(): Queue {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    queue = new Queue("social-posts", { connection });
  }
  return queue;
}

export async function enqueuePublishSocialPost(socialPostId: string, delayMs: number) {
  await getQueue().add("publish", { socialPostId }, { delay: delayMs });
}
