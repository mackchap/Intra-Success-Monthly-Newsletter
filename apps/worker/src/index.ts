import { Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@platform/db";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Placeholder queue/processor proving the worker can reach Redis and Postgres.
// Real queues (email/SMS sequences, drip releases, agent runs) are added in
// Phase 6 as additional Worker instances in this same process.
const worker = new Worker(
  "heartbeat",
  async (job) => {
    const contactCount = await prisma.contact.count();
    console.log(
      `[heartbeat] job ${job.id} ok — ${contactCount} contacts in db`,
    );
  },
  { connection },
);

worker.on("ready", () => {
  console.log("Worker connected to Redis, listening on queue: heartbeat");
});

worker.on("failed", (job, err) => {
  console.error(`[heartbeat] job ${job?.id} failed:`, err);
});

async function shutdown() {
  console.log("Shutting down worker...");
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
