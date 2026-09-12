import Link from "next/link";
import { prisma } from "@platform/db";
import { formatDate, contactName } from "@/lib/format";
import { completeTaskAction } from "../shared-actions";

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    where: { completed: false },
    include: { contact: true, deal: true, assignedTo: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Open tasks</h1>

      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-slate-500">
                {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}
                {task.assignedTo ? ` · ${task.assignedTo.name ?? task.assignedTo.email}` : ""}
                {task.contact ? (
                  <>
                    {" · "}
                    <Link href={`/staff/contacts/${task.contact.id}`} className="text-brand-600">
                      {contactName(task.contact)}
                    </Link>
                  </>
                ) : null}
                {task.deal ? (
                  <>
                    {" · "}
                    <Link href={`/staff/deals/${task.deal.id}`} className="text-brand-600">
                      {task.deal.title}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <form action={completeTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              {task.contactId && <input type="hidden" name="contactId" value={task.contactId} />}
              {task.dealId && <input type="hidden" name="dealId" value={task.dealId} />}
              <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
                Mark done
              </button>
            </form>
          </li>
        ))}
      </ul>
      {tasks.length === 0 && <p className="text-sm text-slate-500">No open tasks. 🎉</p>}
    </div>
  );
}
