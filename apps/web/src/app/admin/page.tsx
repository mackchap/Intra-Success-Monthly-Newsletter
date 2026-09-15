import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-slate-600">
        Signed in as {session?.user?.email} (platform admin).
      </p>
      <p className="mt-4 text-sm text-slate-500">
        Course, funnel, sequence, marketing, and product management now live per-tenant under{" "}
        <a href="/accounts" className="text-brand-600">
          each account&apos;s own admin section
        </a>
        .
      </p>
    </div>
  );
}
