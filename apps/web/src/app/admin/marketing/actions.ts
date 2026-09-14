"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, SocialPostStatus } from "@platform/db";
import { requireStaffSession } from "@/lib/require-staff";
import { draftSocialPost } from "@/lib/agents/social/facebook-instagram";
import { getMarketingRecommendations } from "@/lib/agents/marketing-insights";
import { enqueuePublishSocialPost } from "@/lib/queues/social-posts";
import { str } from "@/lib/form-data";

export async function getMarketingRecommendationsAction(): Promise<string> {
  await requireStaffSession();
  return getMarketingRecommendations();
}

export async function createCampaignAction(formData: FormData) {
  const session = await requireStaffSession();

  const name = str(formData, "name");
  if (!name) throw new Error("Campaign name is required.");

  const campaign = await prisma.campaign.create({
    data: { name, goal: str(formData, "goal"), createdByUserId: session.user.id },
  });

  revalidatePath("/admin/marketing");
  redirect(`/admin/marketing/${campaign.id}`);
}

// Called directly from a Client Component (not a <form action=...>), like
// draftFollowUpEmailAction — this is a live external API call that can
// genuinely fail (rate limits, network issues, not just a bad key), so the
// caller needs a real return/throw to show an inline error instead of
// Next.js's default unhandled-error page.
export async function requestDraftAction(campaignId: string, socialAccountId: string, brief: string): Promise<void> {
  await requireStaffSession();
  if (!campaignId || !socialAccountId || !brief) {
    throw new Error("campaignId, socialAccountId, and brief are required.");
  }

  await draftSocialPost({ campaignId, socialAccountId, brief });
  revalidatePath(`/admin/marketing/${campaignId}`);
}

export async function updatePostAction(formData: FormData) {
  await requireStaffSession();

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");

  await prisma.socialPost.update({
    where: { id: postId },
    data: { caption: str(formData, "caption"), mediaUrl: str(formData, "mediaUrl") ?? null },
  });

  revalidatePath(`/admin/marketing/${campaignId}`);
}

export async function approvePostAction(formData: FormData) {
  const session = await requireStaffSession();

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: SocialPostStatus.APPROVED, approvedByUserId: session.user.id, approvedAt: new Date() },
  });

  revalidatePath(`/admin/marketing/${campaignId}`);
}

export async function rejectPostAction(formData: FormData) {
  await requireStaffSession();

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");

  await prisma.socialPost.update({ where: { id: postId }, data: { status: SocialPostStatus.REJECTED } });
  revalidatePath(`/admin/marketing/${campaignId}`);
}

export async function publishNowAction(formData: FormData) {
  await requireStaffSession();

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");

  const post = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } });
  if (post.status !== SocialPostStatus.APPROVED && post.status !== SocialPostStatus.FAILED) {
    throw new Error("Only an approved (or previously failed) post can be published.");
  }
  if (!post.mediaUrl && post.platform === "INSTAGRAM") {
    throw new Error("Attach an image URL before publishing an Instagram post.");
  }

  await enqueuePublishSocialPost(postId, 0);
  revalidatePath(`/admin/marketing/${campaignId}`);
}

export async function schedulePostAction(formData: FormData) {
  await requireStaffSession();

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  const scheduledForRaw = str(formData, "scheduledFor");
  if (!postId || !campaignId || !scheduledForRaw) {
    throw new Error("postId, campaignId, and scheduledFor are required.");
  }

  const post = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } });
  if (post.status !== SocialPostStatus.APPROVED) {
    throw new Error("Only an approved post can be scheduled.");
  }

  const scheduledFor = new Date(scheduledForRaw);
  const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: SocialPostStatus.SCHEDULED, scheduledFor },
  });
  await enqueuePublishSocialPost(postId, delayMs);

  revalidatePath(`/admin/marketing/${campaignId}`);
}
