import Link from "next/link";
import { prisma } from "@platform/db";
import { createFunnelAction } from "./actions";

export default async function AdminFunnelsPage() {
  const funnels = await prisma.funnel.findMany({
    include: { _count: { select: { steps: true, submissions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Funnels</h1>

      <form action={createFunnelAction} className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3">
        <input name="name" required placeholder="Funnel name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="slug" required placeholder="url-slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
          Create funnel
        </button>
        <textarea
          name="description"
          placeholder="Description"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-3"
        />
      </form>

      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Status</th>
            <th className="py-2">Steps</th>
            <th className="py-2">Leads</th>
          </tr>
        </thead>
        <tbody>
          {funnels.map((funnel) => (
            <tr key={funnel.id} className="border-t border-slate-100">
              <td className="py-2">
                <Link href={`/admin/funnels/${funnel.id}`} className="font-medium text-brand-600">
                  {funnel.name}
                </Link>
              </td>
              <td className="py-2">{funnel.status}</td>
              <td className="py-2">{funnel._count.steps}</td>
              <td className="py-2">{funnel._count.submissions}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {funnels.length === 0 && <p className="mt-4 text-sm text-slate-500">No funnels yet.</p>}
    </div>
  );
}
