import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { contactName, formatMoney } from "@/lib/format";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { Timeline } from "@/components/crm/timeline";
import { NotesPanel } from "@/components/crm/notes-panel";
import { TasksPanel } from "@/components/crm/tasks-panel";
import { moveDealStageAction } from "../actions";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  await requireAccountRole(tenantId, "STAFF");

  const deal = await prisma.deal.findFirst({
    where: { id, tenantId },
    include: {
      contact: true,
      company: true,
      stage: true,
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      notes: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!deal) notFound();

  const otherStages = deal.pipeline.stages.filter((s) => s.id !== deal.stageId);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{deal.title}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/a/${tenantId}/staff/contacts/${deal.contact.id}`} className="text-brand-600">
              {contactName(deal.contact)}
            </Link>
            {deal.company ? (
              <>
                {" · "}
                <Link href={`/a/${tenantId}/staff/companies/${deal.company.id}`} className="text-brand-600">
                  {deal.company.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{formatMoney(deal.valueCents, deal.currency)}</p>
          <p className="text-sm text-slate-500">
            {deal.stage.name} · {deal.status}
          </p>
        </div>
      </div>

      {deal.status === "OPEN" && (
        <form action={moveDealStageAction} className="flex items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="dealId" value={deal.id} />
          <label className="text-sm text-slate-600" htmlFor="stageId">
            Move to stage:
          </label>
          <select id="stageId" name="stageId" className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            {otherStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
            Move
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <TasksPanel tasks={deal.tasks} tenantId={tenantId} dealId={deal.id} />
        <NotesPanel notes={deal.notes} tenantId={tenantId} dealId={deal.id} />
      </div>

      <section>
        <h2 className="mb-2 font-medium">Activity timeline</h2>
        <Timeline activities={deal.activities} />
      </section>
    </div>
  );
}
