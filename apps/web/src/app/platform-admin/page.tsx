import { prisma } from "@platform/db";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const tenants = await prisma.tenant.findMany({
    include: {
      platformSubscription: true,
      _count: { select: { memberships: true, contacts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Platform admin — every account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every business (tenant) running on this platform, and its subscription/Stripe Connect status.
      </p>

      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Plan</th>
            <th className="py-2">Subscription</th>
            <th className="py-2">Stripe Connect</th>
            <th className="py-2">Members</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id} className="border-t border-slate-100">
              <td className="py-2 font-medium">{tenant.name}</td>
              <td className="py-2">{tenant.platformSubscription?.plan ?? "—"}</td>
              <td className="py-2">{tenant.platformSubscription?.status ?? "—"}</td>
              <td className="py-2">{tenant.stripeConnectStatus}</td>
              <td className="py-2">{tenant._count.memberships}</td>
              <td className="py-2">{formatDate(tenant.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tenants.length === 0 && <p className="mt-4 text-sm text-slate-500">No accounts yet.</p>}
    </main>
  );
}
