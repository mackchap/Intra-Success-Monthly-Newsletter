import Link from "next/link";
import { prisma } from "@platform/db";
import { contactName } from "@/lib/format";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { createContactAction } from "./actions";

export default async function ContactsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAccountRole(tenantId, "STAFF");

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      where: { tenantId },
      include: { company: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.company.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
      </div>

      <form action={createContactAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-5">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input name="firstName" placeholder="First name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="lastName" placeholder="Last name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="email" type="email" required placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="companyId" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">No company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white sm:col-span-5 sm:w-fit">
          Add contact
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Company</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-t border-slate-100">
              <td className="py-2">
                <Link href={`/a/${tenantId}/staff/contacts/${contact.id}`} className="font-medium text-brand-600">
                  {contactName(contact)}
                </Link>
              </td>
              <td className="py-2">{contact.email}</td>
              <td className="py-2">{contact.company?.name ?? "—"}</td>
              <td className="py-2">{contact.createdAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {contacts.length === 0 && <p className="text-sm text-slate-500">No contacts yet.</p>}
    </div>
  );
}
