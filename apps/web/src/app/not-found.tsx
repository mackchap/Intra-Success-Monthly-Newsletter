import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="text-brand-600">
        Go home
      </Link>
    </main>
  );
}
