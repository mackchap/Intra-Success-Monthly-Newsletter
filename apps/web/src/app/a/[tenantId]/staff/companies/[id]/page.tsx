import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { contactName, formatMoney } from "@/lib/format";
import { requireAccountRole } from "@/lib/accounts/require-account";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  await requireAccountRole(tenantId, "STAFF");

  const company = await prisma.company.findFirst({
    where: { id, tenantId },
    include: {
      contacts: { orderBy: { createdAt: "desc" } },
      deals: { include: { stage: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!company) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-slate-500">
          {company.industry ?? "—"}
          {company.domain ? ` · ${company.domain}` : ""}
        </p>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Contacts</h2>
        {company.contacts.length === 0 && <p className="text-sm text-slate-500">No contacts yet.</p>}
        <ul className="flex flex-col gap-2">
          {company.contacts.map((contact) => (
            <li key={contact.id}>
              <Link href={`/a/${tenantId}/staff/contacts/${contact.id}`} className="text-sm font-medium text-brand-600">
                {contactName(contact)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Deals</h2>
        {company.deals.length === 0 && <p className="text-sm text-slate-500">No deals yet.</p>}
        <ul className="flex flex-col gap-2">
          {company.deals.map((deal) => (
            <li key={deal.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
              <Link href={`/a/${tenantId}/staff/deals/${deal.id}`} className="font-medium text-brand-600">
                {deal.title}
              </Link>
              <span className="text-slate-500">
                {deal.stage.name} · {formatMoney(deal.valueCents, deal.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
