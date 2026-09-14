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
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.subscription.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enrollment.count({ where: { userId: session.user.id, status: "ACTIVE" } }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Client portal</h1>
          <p className="mt-2 text-slate-600">
            Signed in as {session.user.email}.
          </p>
        </div>
        <form action={manageBillingAction}>
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
            Manage billing
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        <Link href="/portal/courses" className="text-brand-600">
          {enrollmentCount} active course{enrollmentCount === 1 ? "" : "s"} →
        </Link>
      </p>

      <section className="mt-8">
        <h2 className="font-medium">Subscriptions</h2>
        {subscriptions.length === 0 && <p className="mt-2 text-sm text-slate-500">No subscriptions.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="rounded-md border border-slate-200 p-3 text-sm">
              {sub.plan} · {sub.status}
              {sub.status === "ACTIVE" && ` · renews ${formatDate(sub.currentPeriodEnd)}`}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Order history</h2>
        {orders.length === 0 && <p className="mt-2 text-sm text-slate-500">No orders yet.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {orders.map((order) => (
            <li key={order.id} className="flex justify-between rounded-md border border-slate-200 p-3 text-sm">
              <span>{formatDate(order.createdAt)}</span>
              <span>
                {formatMoney(order.amountCents, order.currency)} · {order.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
