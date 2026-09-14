import Link from "next/link";
import { prisma } from "@platform/db";
import { formatMoney, contactName } from "@/lib/format";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { createDealAction, moveDealStageAction } from "./actions";

export default async function DealsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAccountRole(tenantId, "STAFF");

  const pipeline = await prisma.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  const [deals, contacts] = await Promise.all([
    prisma.deal.findMany({
      where: { tenantId },
      include: { stage: true, contact: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contact.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  if (!pipeline) {
    return <p className="text-sm text-slate-500">No pipeline configured yet — run the seed script.</p>;
  }

  const dealsByStage = new Map(pipeline.stages.map((stage) => [stage.id, deals.filter((d) => d.stageId === stage.id)]));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Deals</h1>

      <form
        action={createDealAction}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-5"
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input name="title" required placeholder="Deal title" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="contactId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Contact...</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contactName(contact)}
            </option>
          ))}
        </select>
        <select name="stageId" required defaultValue={pipeline.stages[0]?.id} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {pipeline.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        <input
          name="valueDollars"
          type="number"
          step="0.01"
          min="0"
          placeholder="Value ($)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
          Add deal
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-3 lg:grid-cols-6">
        {pipeline.stages.map((stage) => {
          const stageDeals = dealsByStage.get(stage.id) ?? [];
          const stageValue = stageDeals.reduce((sum, deal) => sum + deal.valueCents, 0);

          return (
            <div key={stage.id} className="flex min-w-[220px] flex-col gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <h2 className="font-medium">{stage.name}</h2>
                <p className="text-xs text-slate-500">{formatMoney(stageValue)}</p>
              </div>
              <div className="flex flex-col gap-2">
                {stageDeals.map((deal) => {
                  const nextStages = pipeline.stages.filter((s) => s.id !== deal.stageId);
                  return (
                    <div key={deal.id} className="rounded-md bg-slate-50 p-2 text-sm">
                      <Link href={`/a/${tenantId}/staff/deals/${deal.id}`} className="font-medium text-brand-600">
                        {deal.title}
                      </Link>
                      <p className="text-xs text-slate-500">{contactName(deal.contact)}</p>
                      <p className="text-xs text-slate-500">{formatMoney(deal.valueCents, deal.currency)}</p>
                      {deal.status === "OPEN" && (
                        <form action={moveDealStageAction} className="mt-2 flex gap-1">
                          <input type="hidden" name="tenantId" value={tenantId} />
                          <input type="hidden" name="dealId" value={deal.id} />
                          <select name="stageId" className="flex-1 rounded border border-slate-300 text-xs">
                            {nextStages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="rounded bg-brand-600 px-2 py-0.5 text-xs text-white">
                            Move
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
                {stageDeals.length === 0 && <p className="text-xs text-slate-400">No deals</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
