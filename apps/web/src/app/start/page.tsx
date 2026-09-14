import Link from "next/link";
import { requireSession } from "@/lib/require-auth";
import { createAccountAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StartAccountPage() {
  await requireSession();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Start your business</h1>
        <p className="mt-1 text-sm text-slate-500">
          This creates a brand new account with its own CRM — you&apos;ll be its Owner, with a 14-day trial to try
          the platform before subscribing.
        </p>
      </div>

      <form action={createAccountAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Business name
          <input
            name="name"
            required
            placeholder="Acme Co."
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white">
          Create account
        </button>
      </form>

      <Link href="/accounts" className="text-sm text-brand-600">
        ← Back to your accounts
      </Link>
    </main>
  );
}
