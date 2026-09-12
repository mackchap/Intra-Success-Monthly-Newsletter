import Link from "next/link";

// Admin pages read live, admin-only data — never statically prerender.
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/funnels", label: "Funnels" },
  { href: "/admin/sequences", label: "Sequences" },
  { href: "/admin/products", label: "Products" },
  { href: "/staff", label: "Staff area ↗" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="font-semibold">Intra Success Academy · Admin</span>
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
