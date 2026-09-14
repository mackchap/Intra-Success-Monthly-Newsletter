import Link from "next/link";
import { prisma } from "@platform/db";
import { createCampaignAction } from "./actions";
import { InsightsAdvice } from "@/components/marketing/insights-advice";

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;

  const [accounts, campaigns] = await Promise.all([
    prisma.socialAccount.findMany({ where: { disconnectedAt: null }, orderBy: { connectedAt: "desc" } }),
    prisma.campaign.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Agent-drafted Facebook &amp; Instagram campaigns — every post is reviewed and approved by
          staff before it ever reaches Meta.
        </p>
      </div>

      {connected && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Connected {connected} Facebook Page{connected === "1" ? "" : "s"} (and any linked Instagram accounts).
        </p>
      )}
      {error === "invalid_state" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          That connection attempt looked invalid and was rejected. Try connecting again.
        </p>
      )}
      {error === "connect_failed" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Couldn&apos;t connect to Meta. Check that META_APP_ID/META_APP_SECRET are configured and try again.
        </p>
      )}

      <section>
        <h2 className="mb-2 font-medium">Connected accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No accounts connected yet.{" "}
            <a href="/api/social/meta/connect" className="text-brand-600">
              Connect Facebook &amp; Instagram
            </a>
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {accounts.map((account) => (
                <li key={account.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <span className="font-medium">{account.displayName}</span>{" "}
                  <span className="text-slate-500">({account.platform})</span>
                </li>
              ))}
            </ul>
            <a href="/api/social/meta/connect" className="mt-2 inline-block text-sm text-brand-600">
              Connect another Page
            </a>
          </>
        )}
      </section>

      <section>
        <h2 className="font-medium">Campaigns</h2>
        <form action={createCampaignAction} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input name="name" required placeholder="Campaign name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="goal" placeholder="Goal (optional brief)" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1" />
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
            New campaign
          </button>
        </form>

        <ul className="mt-6 flex flex-col gap-2">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
              <Link href={`/admin/marketing/${campaign.id}`} className="font-medium text-brand-600">
                {campaign.name}
              </Link>
              <span className="text-slate-500">
                {campaign._count.posts} post{campaign._count.posts === 1 ? "" : "s"} · {campaign.status}
              </span>
            </li>
          ))}
          {campaigns.length === 0 && <p className="text-sm text-slate-500">No campaigns yet.</p>}
        </ul>
      </section>

      <InsightsAdvice />
    </div>
  );
}
