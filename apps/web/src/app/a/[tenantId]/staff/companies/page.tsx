import Link from "next/link";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { createCompanyAction } from "./actions";

export default async function CompaniesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAccountRole(tenantId, "STAFF");

  const companies = await prisma.company.findMany({
    where: { tenantId },
    include: { _count: { select: { contacts: true, deals: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Companies</h1>

      <form action={createCompanyAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-4">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input name="name" required placeholder="Company name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="domain" placeholder="Domain" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="industry" placeholder="Industry" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="website" placeholder="Website" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white sm:col-span-4 sm:w-fit">
          Add company
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Industry</th>
            <th className="py-2">Contacts</th>
            <th className="py-2">Deals</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-t border-slate-100">
              <td className="py-2">
                <Link href={`/a/${tenantId}/staff/companies/${company.id}`} className="font-medium text-brand-600">
                  {company.name}
                </Link>
              </td>
              <td className="py-2">{company.industry ?? "—"}</td>
              <td className="py-2">{company._count.contacts}</td>
              <td className="py-2">{company._count.deals}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {companies.length === 0 && <p className="text-sm text-slate-500">No companies yet.</p>}
    </div>
  );
}
