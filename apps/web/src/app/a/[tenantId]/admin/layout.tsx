import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccountRole } from "@/lib/accounts/require-account";

// Tenant-scoped admin surfaces (Funnels, Academy, Marketing, Products,
// Sequences — tenant-scoped starting Phase 9). Requires ADMIN+, not just
// STAFF, since these are authoring/settings-level actions rather than
// day-to-day CRM work. Always reads live, per-request data.
export const dynamic = "force-dynamic";

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { membership } = await requireAccountRole(tenantId, "ADMIN").catch(() => ({ membership: null }));
  if (!membership) notFound();

  const NAV_ITEMS = [
    { href: `/a/${tenantId}/admin/courses`, label: "Courses" },
    { href: `/a/${tenantId}/admin/funnels`, label: "Funnels" },
    { href: `/a/${tenantId}/admin/sequences`, label: "Sequences" },
    { href: `/a/${tenantId}/admin/marketing`, label: "Marketing" },
    { href: `/a/${tenantId}/admin/products`, label: "Products" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href={`/a/${tenantId}/staff`} className="font-semibold hover:text-brand-600">
            ← CRM
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
