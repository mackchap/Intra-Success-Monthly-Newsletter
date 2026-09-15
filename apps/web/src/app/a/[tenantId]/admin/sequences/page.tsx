import Link from "next/link";
import { prisma } from "@platform/db";
import { createSequenceAction } from "./actions";

export default async function AdminSequencesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const [sequences, funnels] = await Promise.all([
    prisma.sequence.findMany({
      where: { tenantId },
      include: { funnel: true, _count: { select: { steps: true, enrollments: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.funnel.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Sequences</h1>
      <p className="mt-1 text-sm text-slate-500">
        Email/SMS automation, triggered by a funnel opt-in or an abandoned checkout. Sent by the worker
        service (BullMQ) — never inline in a request.
      </p>

      <form action={createSequenceAction} className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-4">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input name="name" required placeholder="Sequence name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="trigger" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="WELCOME">Welcome (on opt-in)</option>
          <option value="FUNNEL_STAGE_ENTERED">Funnel stage entered</option>
          <option value="ABANDONED_CHECKOUT">Abandoned checkout</option>
          <option value="MANUAL">Manual only</option>
        </select>
        <select name="funnelId" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">No specific funnel</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
          Create sequence
        </button>
      </form>

      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Trigger</th>
            <th className="py-2">Funnel</th>
            <th className="py-2">Steps</th>
            <th className="py-2">Enrolled</th>
            <th className="py-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {sequences.map((sequence) => (
            <tr key={sequence.id} className="border-t border-slate-100">
              <td className="py-2">
                <Link href={`/a/${tenantId}/admin/sequences/${sequence.id}`} className="font-medium text-brand-600">
                  {sequence.name}
                </Link>
              </td>
              <td className="py-2">{sequence.trigger}</td>
              <td className="py-2">{sequence.funnel?.name ?? "—"}</td>
              <td className="py-2">{sequence._count.steps}</td>
              <td className="py-2">{sequence._count.enrollments}</td>
              <td className="py-2">{sequence.active ? "✅" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sequences.length === 0 && <p className="mt-4 text-sm text-slate-500">No sequences yet.</p>}
    </div>
  );
}
