import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma, SocialPlatform, SocialPostStatus } from "@platform/db";
import { decryptToken } from "../social/crypto";
import { publishFacebookPagePost, publishInstagramPost } from "../social/meta";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const socialPostQueue = new Queue("social-posts", { connection });

export interface SocialPostJobData {
  socialPostId: string;
}

export async function enqueuePublishSocialPost(socialPostId: string, delayMs: number) {
  await socialPostQueue.add("publish", { socialPostId }, { delay: delayMs });
}

// Exported standalone (same rationale as every other job processor in this
// worker) so it's unit-testable without a real BullMQ Worker/Redis
// connection. Handles both an immediate "publish now" job (delay 0) and a
// scheduled one — the only difference is how long BullMQ held the job.
export async function processSocialPostJob(data: SocialPostJobData) {
  const post = await prisma.socialPost.findUnique({
    where: { id: data.socialPostId },
    include: { socialAccount: true },
  });
  if (!post) return;
  if (post.status !== SocialPostStatus.APPROVED && post.status !== SocialPostStatus.SCHEDULED) {
    return; // already published, or rejected/edited away from APPROVED since this job was queued
  }

  await prisma.socialPost.update({ where: { id: post.id }, data: { status: SocialPostStatus.PUBLISHING } });

  try {
    const accessToken = decryptToken(post.socialAccount.accessTokenEncrypted);
    const result =
      post.platform === SocialPlatform.INSTAGRAM
        ? await publishInstagramPost({
            igUserId: post.socialAccount.externalId,
            accessToken,
            caption: post.caption,
            imageUrl: post.mediaUrl ?? "",
          })
        : await publishFacebookPagePost({
            pageId: post.socialAccount.externalId,
            accessToken,
            message: post.caption,
          });

    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: SocialPostStatus.PUBLISHED,
        publishedAt: new Date(),
        externalPostId: result.externalPostId,
        error: null,
      },
    });
  } catch (error) {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: SocialPostStatus.FAILED, error: error instanceof Error ? error.message : String(error) },
    });
  }
}

export function createSocialPostWorker() {
  return new Worker<SocialPostJobData>(
    "social-posts",
    (job: Job<SocialPostJobData>) => processSocialPostJob(job.data),
    { connection },
  );
}
