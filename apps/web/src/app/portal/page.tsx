import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@platform/db";
import { formatDate, formatMoney } from "@/lib/format";
import { manageBillingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [orders, subscriptions, enrollmentCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id },
      include: { tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.subscription.findMany({
      where: { userId: session.user.id },
      include: { tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enrollment.count({ where: { userId: session.user.id, status: "ACTIVE" } }),
  ]);

  // A portal user can have bought from more than one tenant (Phase 9) —
  // billing is per-tenant (each settles on that tenant's own connected
  // Stripe account), so group by tenant rather than showing one global
  // "manage billing" button.
  const tenantsById = new Map<string, { id: string; name: string }>();
  for (const row of [...orders, ...subscriptions]) {
    tenantsById.set(row.tenant.id, row.tenant);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Client portal</h1>
        <p className="mt-2 text-slate-600">Signed in as {session.user.email}.</p>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        <Link href="/portal/courses" className="text-brand-600">
          {enrollmentCount} active course{enrollmentCount === 1 ? "" : "s"} →
        </Link>
      </p>

      {[...tenantsById.values()].map((tenant) => (
        <section key={tenant.id} className="mt-10 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{tenant.name}</h2>
            <form action={manageBillingAction}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
                Manage billing
              </button>
            </form>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500">Subscriptions</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {subscriptions
                .filter((sub) => sub.tenant.id === tenant.id)
                .map((sub) => (
                  <li key={sub.id} className="rounded-md bg-slate-50 p-3 text-sm">
                    {sub.plan} · {sub.status}
                    {sub.status === "ACTIVE" && ` · renews ${formatDate(sub.currentPeriodEnd)}`}
                  </li>
                ))}
              {subscriptions.filter((sub) => sub.tenant.id === tenant.id).length === 0 && (
                <p className="text-sm text-slate-500">No subscriptions.</p>
              )}
            </ul>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500">Order history</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {orders
                .filter((order) => order.tenant.id === tenant.id)
                .map((order) => (
                  <li key={order.id} className="flex justify-between rounded-md bg-slate-50 p-3 text-sm">
                    <span>{formatDate(order.createdAt)}</span>
                    <span>
                      {formatMoney(order.amountCents, order.currency)} · {order.status}
                    </span>
                  </li>
                ))}
              {orders.filter((order) => order.tenant.id === tenant.id).length === 0 && (
                <p className="text-sm text-slate-500">No orders yet.</p>
              )}
            </ul>
          </div>
        </section>
      ))}
      {tenantsById.size === 0 && <p className="mt-8 text-sm text-slate-500">No purchases yet.</p>}
    </main>
  );
}
