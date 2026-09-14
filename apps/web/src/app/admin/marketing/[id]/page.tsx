import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { approvePostAction, publishNowAction, rejectPostAction, schedulePostAction, updatePostAction } from "../actions";
import { DraftRequestForm } from "@/components/marketing/draft-request-form";

const EDITABLE_STATUSES = new Set(["DRAFT", "APPROVED", "FAILED"]);

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  APPROVED: "bg-blue-50 text-blue-700",
  SCHEDULED: "bg-amber-50 text-amber-700",
  PUBLISHING: "bg-amber-50 text-amber-700",
  PUBLISHED: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
  REJECTED: "bg-slate-100 text-slate-500",
};

export default async function AdminCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [campaign, accounts] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: { posts: { include: { socialAccount: true }, orderBy: { createdAt: "desc" } } },
    }),
    prisma.socialAccount.findMany({ where: { disconnectedAt: null }, orderBy: { displayName: "asc" } }),
  ]);
  if (!campaign) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/admin/marketing" className="text-brand-600">
            ← Marketing
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        {campaign.goal && <p className="mt-1 text-sm text-slate-500">{campaign.goal}</p>}
      </div>

      <section>
        <h2 className="font-medium">Ask the agent for a draft</h2>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Connect a Facebook or Instagram account first from the{" "}
            <Link href="/admin/marketing" className="text-brand-600">
              Marketing
            </Link>{" "}
            page.
          </p>
        ) : (
          <DraftRequestForm campaignId={campaign.id} accounts={accounts} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Posts</h2>
        {campaign.posts.length === 0 && <p className="text-sm text-slate-500">No posts yet.</p>}
        {campaign.posts.map((post) => (
          <div key={post.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{post.socialAccount.displayName}</span>
                <span className="text-slate-400">· {post.platform}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[post.status] ?? "bg-slate-100"}`}>
                  {post.status}
                </span>
              </div>
              {post.scheduledFor && (
                <span className="text-xs text-slate-500">Scheduled for {post.scheduledFor.toLocaleString()}</span>
              )}
              {post.publishedAt && (
                <span className="text-xs text-slate-500">Published {post.publishedAt.toLocaleString()}</span>
              )}
            </div>

            {post.error && <p className="mt-2 text-sm text-red-600">Error: {post.error}</p>}

            {EDITABLE_STATUSES.has(post.status) ? (
              <form action={updatePostAction} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <textarea
                  name="caption"
                  defaultValue={post.caption}
                  rows={4}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="mediaUrl"
                  defaultValue={post.mediaUrl ?? ""}
                  placeholder="Image/video URL to attach"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {post.imageBrief && (
                  <p className="text-xs text-slate-500">Agent&apos;s image suggestion: {post.imageBrief}</p>
                )}
                <button type="submit" className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium">
                  Save changes
                </button>
              </form>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{post.caption}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {post.status === "DRAFT" && (
                <>
                  <form action={approvePostAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
                      Approve
                    </button>
                  </form>
                  <form action={rejectPostAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-red-600">
                      Reject
                    </button>
                  </form>
                </>
              )}

              {(post.status === "APPROVED" || post.status === "FAILED") && (
                <>
                  <form action={publishNowAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
                      {post.status === "FAILED" ? "Retry publish" : "Publish now"}
                    </button>
                  </form>
                  {post.status === "APPROVED" && (
                    <form action={schedulePostAction} className="flex items-center gap-2">
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <input
                        type="datetime-local"
                        name="scheduledFor"
                        required
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium">
                        Schedule
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
