import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@platform/db";
import { getFunnelAnalytics } from "@/lib/funnels/analytics";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { formatMoney } from "@/lib/format";
import { OptimizerAdvice } from "@/components/funnels/optimizer-advice";

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default async function FunnelAnalyticsPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  await requireAccountRole(tenantId, "ADMIN");

  const funnel = await prisma.funnel.findFirst({ where: { id, tenantId } });
  if (!funnel) notFound();

  const analytics = await getFunnelAnalytics(id);
  const topOfFunnelVisitors = analytics.steps[0]?.uniqueVisitors ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href={`/a/${tenantId}/admin/funnels/${id}`} className="text-brand-600">
            ← {funnel.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Analytics</h1>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Top-of-funnel visitors</p>
          <p className="mt-1 text-2xl font-semibold">{topOfFunnelVisitors}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Leads captured</p>
          <p className="mt-1 text-2xl font-semibold">{analytics.totalLeads}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Paid orders</p>
          <p className="mt-1 text-2xl font-semibold">{analytics.paidOrders}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Revenue</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(analytics.revenueCents, "usd")}</p>
        </div>
      </section>

      <section>
        <h2 className="font-medium">Step-by-step funnel</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2">Step</th>
              <th className="py-2">Visits</th>
              <th className="py-2">Unique visitors</th>
              <th className="py-2">Submissions</th>
              <th className="py-2">→ Next step</th>
              <th className="py-2">Drop-off</th>
            </tr>
          </thead>
          <tbody>
            {analytics.steps.map((step) => (
              <tr key={step.stepId} className="border-t border-slate-100">
                <td className="py-2 font-medium">{step.name}</td>
                <td className="py-2">{step.totalVisits}</td>
                <td className="py-2">{step.uniqueVisitors}</td>
                <td className="py-2">{step.submissions}</td>
                <td className="py-2">{pct(step.conversionToNext)}</td>
                <td className="py-2 text-red-600">
                  {step.conversionToNext === null ? "—" : pct(1 - step.conversionToNext)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {analytics.steps.length === 0 && <p className="mt-4 text-sm text-slate-500">No steps yet.</p>}
      </section>

      <OptimizerAdvice tenantId={tenantId} funnelId={id} />
    </div>
  );
}
