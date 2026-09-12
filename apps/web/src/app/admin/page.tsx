import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-slate-600">
        Signed in as {session?.user?.email} ({session?.user?.role}).
      </p>
      <p className="mt-4 text-sm text-slate-500">Funnels and academy management tools land in later phases.</p>
    </div>
  );
}
