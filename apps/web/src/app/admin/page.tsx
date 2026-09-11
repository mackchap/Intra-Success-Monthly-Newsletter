import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-slate-600">
        Signed in as {session?.user?.email} ({session?.user?.role}).
      </p>
      <p className="mt-4 text-sm text-slate-500">
        CRM, funnels, and academy management tools land here in later phases.
      </p>
    </main>
  );
}
