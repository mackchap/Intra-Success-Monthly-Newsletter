import Link from "next/link";

// Every page under /staff reads live, staff-only data straight from the DB —
// never statically prerender it (and building would fail anyway: there's no
// DATABASE_URL available at build time).
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/contacts", label: "Contacts" },
  { href: "/staff/companies", label: "Companies" },
  { href: "/staff/deals", label: "Deals" },
  { href: "/staff/tasks", label: "Tasks" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="font-semibold">Intra Success Academy</span>
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
