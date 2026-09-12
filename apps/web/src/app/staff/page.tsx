import Link from "next/link";
import { prisma } from "@platform/db";

export default async function StaffDashboardPage() {
  const [contactCount, openDealCount, openTaskCount, pipelineValue] = await Promise.all([
    prisma.contact.count(),
    prisma.deal.count({ where: { status: "OPEN" } }),
    prisma.task.count({ where: { completed: false } }),
    prisma.deal.aggregate({ where: { status: "OPEN" }, _sum: { valueCents: true } }),
  ]);

  const stats = [
    { label: "Contacts", value: contactCount, href: "/staff/contacts" },
    { label: "Open deals", value: openDealCount, href: "/staff/deals" },
    { label: "Open tasks", value: openTaskCount, href: "/staff/tasks" },
    {
      label: "Open pipeline value",
      value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        (pipelineValue._sum.valueCents ?? 0) / 100,
      ),
      href: "/staff/deals",
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
