import Link from "next/link";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";

export default async function StaffDashboardPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAccountRole(tenantId, "STAFF");

  const [contactCount, openDealCount, openTaskCount, pipelineValue] = await Promise.all([
    prisma.contact.count({ where: { tenantId } }),
    prisma.deal.count({ where: { tenantId, status: "OPEN" } }),
    prisma.task.count({ where: { tenantId, completed: false } }),
    prisma.deal.aggregate({ where: { tenantId, status: "OPEN" }, _sum: { valueCents: true } }),
  ]);

  const stats = [
    { label: "Contacts", value: contactCount, href: `/a/${tenantId}/staff/contacts` },
    { label: "Open deals", value: openDealCount, href: `/a/${tenantId}/staff/deals` },
    { label: "Open tasks", value: openTaskCount, href: `/a/${tenantId}/staff/tasks` },
    {
      label: "Open pipeline value",
      value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        (pipelineValue._sum.valueCents ?? 0) / 100,
      ),
      href: `/a/${tenantId}/staff/deals`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border border-slate-200 p-4 hover:border-brand-500"
          >
            <div className="text-2xl font-semibold">{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
