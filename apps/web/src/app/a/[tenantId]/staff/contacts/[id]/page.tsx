import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { contactName, formatMoney } from "@/lib/format";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { Timeline } from "@/components/crm/timeline";
import { NotesPanel } from "@/components/crm/notes-panel";
import { TasksPanel } from "@/components/crm/tasks-panel";
import { FollowUpDrafter } from "@/components/crm/follow-up-drafter";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  await requireAccountRole(tenantId, "STAFF");

  // Scoped by tenantId, not just id — a valid contact id belonging to a
  // different tenant must 404, not leak that tenant's CRM data.
  const contact = await prisma.contact.findFirst({
    where: { id, tenantId },
    include: {
      company: true,
      deals: { include: { stage: true }, orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!contact) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{contactName(contact)}</h1>
        <p className="text-sm text-slate-500">
          {contact.email}
          {contact.phone ? ` · ${contact.phone}` : ""}
          {contact.company ? (
            <>
              {" · "}
              <Link href={`/a/${tenantId}/staff/companies/${contact.company.id}`} className="text-brand-600">
                {contact.company.name}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Deals</h2>
        {contact.deals.length === 0 && <p className="text-sm text-slate-500">No deals yet.</p>}
        <ul className="flex flex-col gap-2">
          {contact.deals.map((deal) => (
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

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <TasksPanel tasks={contact.tasks} tenantId={tenantId} contactId={contact.id} />
        <NotesPanel notes={contact.notes} tenantId={tenantId} contactId={contact.id} />
      </div>

      <FollowUpDrafter tenantId={tenantId} contactId={contact.id} />

      <section>
        <h2 className="mb-2 font-medium">Activity timeline</h2>
        <Timeline activities={contact.activities} />
      </section>
    </div>
  );
}
