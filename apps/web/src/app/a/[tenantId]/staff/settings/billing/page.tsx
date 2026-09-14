import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { formatDate } from "@/lib/format";
import { subscribeToPlatformAction } from "./actions";

const CONNECT_STATUS_LABEL: Record<string, string> = {
  NOT_CONNECTED: "Not connected",
  PENDING: "Onboarding in progress",
  ACTIVE: "Connected — ready to accept payments",
  RESTRICTED: "Restricted by Stripe — action needed",
};

export default async function BillingSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { membership } = await requireAccountRole(tenantId, "STAFF");

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    include: { platformSubscription: true },
  });

  const isOwner = membership.role === "OWNER";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Billing</h1>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="font-medium">Your platform subscription</h2>
        <p className="mt-1 text-sm text-slate-500">What you pay to run your business on this platform.</p>
        <div className="mt-3 text-sm">
          <p>
            Plan: <span className="font-medium">{tenant.platformSubscription?.plan ?? "—"}</span> · Status:{" "}
            <span className="font-medium">{tenant.platformSubscription?.status ?? "—"}</span>
          </p>
          {tenant.platformSubscription?.trialEndsAt && tenant.platformSubscription.status === "TRIALING" && (
            <p className="mt-1 text-slate-500">Trial ends {formatDate(tenant.platformSubscription.trialEndsAt)}.</p>
          )}
        </div>
        {isOwner && tenant.platformSubscription?.status !== "ACTIVE" && (
          <form action={subscribeToPlatformAction} className="mt-3">
            <input type="hidden" name="tenantId" value={tenantId} />
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
              Subscribe now
            </button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="font-medium">Get paid — connect Stripe</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your own customers&apos; payments (course sales, listing upgrades, funnel offers) settle directly into your
          own Stripe account, never ours.
        </p>
        <p className="mt-3 text-sm">
          Status:{" "}
          <span className="font-medium">
            {CONNECT_STATUS_LABEL[tenant.stripeConnectStatus] ?? tenant.stripeConnectStatus}
          </span>
        </p>
        {isOwner && tenant.stripeConnectStatus !== "ACTIVE" && (
          <a
            href={`/api/billing/connect/start?tenantId=${tenantId}`}
            className="mt-3 inline-block rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
          >
            {tenant.stripeConnectAccountId ? "Continue Stripe onboarding" : "Connect Stripe"}
          </a>
        )}
        {!isOwner && <p className="mt-2 text-xs text-slate-400">Only the account Owner can manage billing.</p>}
      </section>
    </div>
  );
}
