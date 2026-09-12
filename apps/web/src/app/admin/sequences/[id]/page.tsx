import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { createSequenceStepAction, toggleSequenceActiveAction } from "../actions";

export default async function AdminSequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sequence = await prisma.sequence.findUnique({
    where: { id },
    include: { funnel: true, steps: { orderBy: { order: "asc" } } },
  });
  if (!sequence) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{sequence.name}</h1>
          <p className="text-sm text-slate-500">
            {sequence.trigger}
            {sequence.funnel ? ` · ${sequence.funnel.name}` : ""}
          </p>
        </div>
        <form action={toggleSequenceActiveAction}>
          <input type="hidden" name="sequenceId" value={sequence.id} />
          <input type="hidden" name="active" value={String(sequence.active)} />
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
            {sequence.active ? "Deactivate" : "Activate"}
          </button>
        </form>
      </div>

      <section>
        <h2 className="font-medium">Steps</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {sequence.steps.map((step) => (
            <li key={step.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <p className="font-medium">
                Step {step.order + 1} · {step.channel} · {step.delayMinutes === 0 ? "immediately" : `${step.delayMinutes} min after previous`}
              </p>
              {step.subject && <p className="text-slate-600">Subject: {step.subject}</p>}
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{step.body}</p>
            </li>
          ))}
          {sequence.steps.length === 0 && <p className="text-sm text-slate-500">No steps yet.</p>}
        </ul>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-600">Add step</summary>
          <form action={createSequenceStepAction} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input type="hidden" name="sequenceId" value={sequence.id} />
            <select name="channel" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </select>
            <input
              name="delayMinutes"
              type="number"
              min="0"
              placeholder="Delay in minutes after previous step (0 = immediate)"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              name="subject"
              placeholder="Email subject (ignored for SMS)"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
            />
            <textarea
              name="body"
              required
              placeholder="Message body"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
            />
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white sm:col-span-2 sm:w-fit">
              Add step
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
