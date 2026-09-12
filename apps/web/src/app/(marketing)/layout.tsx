import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold">
            Intra Success Academy
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-600">
            {NAV_ITEMS.slice(1).map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-slate-900">
                {item.label}
              </Link>
            ))}
            <Link href="/login" className="hover:text-slate-900">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-slate-500">
          © {new Date().getFullYear()} Intra Success Academy. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
