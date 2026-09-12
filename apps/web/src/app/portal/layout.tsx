import Link from "next/link";

export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/courses", label: "My Courses" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-2xl items-center gap-6 px-6 py-4">
          <Link href="/" className="font-semibold">
            Intra Success Academy
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
      {children}
    </div>
  );
}
