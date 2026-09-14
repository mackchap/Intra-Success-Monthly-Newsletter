import Link from "next/link";
import { requireSession } from "@/lib/require-auth";
import { listMembershipsForUser } from "@/lib/accounts/tenants";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  STAFF: "Staff",
  CUSTOMER: "Customer",
};

export default async function AccountsPage() {
  const session = await requireSession();
  const memberships = await listMembershipsForUser(session.user.id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Your accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each account is a separate business running on this platform — its own CRM, its own data, its own team.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {memberships.map((membership) => (
          <li key={membership.id}>
            <Link
              href={`/a/${membership.tenantId}/staff`}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-brand-500"
            >
              <div>
                <p className="font-medium">{membership.tenant.name}</p>
                <p className="text-sm text-slate-500">{ROLE_LABEL[membership.role] ?? membership.role}</p>
              </div>
              <span className="text-brand-600">Open →</span>
            </Link>
          </li>
        ))}
        {memberships.length === 0 && (
          <p className="text-sm text-slate-500">You don&apos;t belong to any account yet.</p>
        )}
      </ul>

      <Link
        href="/start"
        className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white"
      >
        + Start a new business account
      </Link>
    </main>
  );
}
