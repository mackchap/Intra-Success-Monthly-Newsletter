import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccountRole } from "@/lib/accounts/require-account";

// Every page under /a/[tenantId]/staff reads live, tenant-scoped data
// straight from the DB — never statically prerender it (and building would
// fail anyway: there's no DATABASE_URL available at build time).
export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { membership } = await requireAccountRole(tenantId, "STAFF").catch(() => ({ membership: null }));
  if (!membership) notFound();

  const NAV_ITEMS = [
    { href: `/a/${tenantId}/staff`, label: "Dashboard" },
    { href: `/a/${tenantId}/staff/contacts`, label: "Contacts" },
    { href: `/a/${tenantId}/staff/companies`, label: "Companies" },
    { href: `/a/${tenantId}/staff/deals`, label: "Deals" },
    { href: `/a/${tenantId}/staff/tasks`, label: "Tasks" },
    { href: `/a/${tenantId}/staff/settings/billing`, label: "Billing" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/accounts" className="font-semibold hover:text-brand-600">
            ← Accounts
          </Link>
          <div className="flex gap-4 text-sm text-slate-600">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
