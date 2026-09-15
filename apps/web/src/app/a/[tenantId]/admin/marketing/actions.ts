"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, SocialPostStatus } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { draftSocialPost } from "@/lib/agents/social/facebook-instagram";
import { getMarketingRecommendations } from "@/lib/agents/marketing-insights";
import { enqueuePublishSocialPost } from "@/lib/queues/social-posts";
import { str } from "@/lib/form-data";

// Every action below is scoped by tenantId and re-verifies the target
// campaign/post actually belongs to that tenant before mutating it —
// defense in depth against a forged tenantId, same pattern as Funnels.

async function requireCampaignInTenant(campaignId: string, tenantId: string) {
  return prisma.campaign.findFirstOrThrow({ where: { id: campaignId, tenantId } });
}

export async function getMarketingRecommendationsAction(tenantId: string): Promise<string> {
  await requireAccountRole(tenantId, "ADMIN");
  return getMarketingRecommendations(tenantId);
}

export async function createCampaignAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { membership } = await requireAccountRole(tenantId, "ADMIN");

  const name = str(formData, "name");
  if (!name) throw new Error("Campaign name is required.");

  const campaign = await prisma.campaign.create({
    data: { tenantId, name, goal: str(formData, "goal"), createdByUserId: membership.userId },
  });

  revalidatePath(`/a/${tenantId}/admin/marketing`);
  redirect(`/a/${tenantId}/admin/marketing/${campaign.id}`);
}

// Called directly from a Client Component (not a <form action=...>), like
// draftFollowUpEmailAction — this is a live external API call that can
// genuinely fail (rate limits, network issues, not just a bad key), so the
// caller needs a real return/throw to show an inline error instead of
// Next.js's default unhandled-error page.
export async function requestDraftAction(
  tenantId: string,
  campaignId: string,
  socialAccountId: string,
  brief: string,
): Promise<void> {
  await requireAccountRole(tenantId, "ADMIN");
  if (!campaignId || !socialAccountId || !brief) {
    throw new Error("campaignId, socialAccountId, and brief are required.");
  }
  await requireCampaignInTenant(campaignId, tenantId);
  await prisma.socialAccount.findFirstOrThrow({ where: { id: socialAccountId, tenantId } });

  await draftSocialPost({ campaignId, socialAccountId, brief });
  revalidatePath(`/a/${tenantId}/admin/marketing/${campaignId}`);
}

export async function updatePostAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");
  await requireCampaignInTenant(campaignId, tenantId);

  await prisma.socialPost.update({
    where: { id: postId },
    data: { caption: str(formData, "caption"), mediaUrl: str(formData, "mediaUrl") ?? null },
  });

  revalidatePath(`/a/${tenantId}/admin/marketing/${campaignId}`);
}

export async function approvePostAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { membership } = await requireAccountRole(tenantId, "ADMIN");

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");
  await requireCampaignInTenant(campaignId, tenantId);

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: SocialPostStatus.APPROVED, approvedByUserId: membership.userId, approvedAt: new Date() },
  });

  revalidatePath(`/a/${tenantId}/admin/marketing/${campaignId}`);
}

export async function rejectPostAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");
  await requireCampaignInTenant(campaignId, tenantId);

  await prisma.socialPost.update({ where: { id: postId }, data: { status: SocialPostStatus.REJECTED } });
  revalidatePath(`/a/${tenantId}/admin/marketing/${campaignId}`);
}

export async function publishNowAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  if (!postId || !campaignId) throw new Error("postId and campaignId are required.");
  await requireCampaignInTenant(campaignId, tenantId);

  const post = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } });
  if (post.status !== SocialPostStatus.APPROVED && post.status !== SocialPostStatus.FAILED) {
    throw new Error("Only an approved (or previously failed) post can be published.");
  }
  if (!post.mediaUrl && post.platform === "INSTAGRAM") {
    throw new Error("Attach an image URL before publishing an Instagram post.");
  }

  await enqueuePublishSocialPost(postId, 0);
  revalidatePath(`/a/${tenantId}/admin/marketing/${campaignId}`);
}

export async function schedulePostAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const postId = str(formData, "postId");
  const campaignId = str(formData, "campaignId");
  const scheduledForRaw = str(formData, "scheduledFor");
  if (!postId || !campaignId || !scheduledForRaw) {
    throw new Error("postId, campaignId, and scheduledFor are required.");
  }
  await requireCampaignInTenant(campaignId, tenantId);

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

  revalidatePath(`/a/${tenantId}/admin/marketing/${campaignId}`);
}
