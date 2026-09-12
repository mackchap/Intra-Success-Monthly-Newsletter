import type { Task } from "@platform/db";
import { addTaskAction, completeTaskAction } from "@/app/staff/shared-actions";
import { formatDate } from "@/lib/format";

export function TasksPanel({
  tasks,
  contactId,
  dealId,
}: {
  tasks: Task[];
  contactId?: string;
  dealId?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-medium">Tasks</h2>
      <form action={addTaskAction} className="flex flex-col gap-2 sm:flex-row">
        {contactId && <input type="hidden" name="contactId" value={contactId} />}
        {dealId && <input type="hidden" name="dealId" value={dealId} />}
        <input
          name="title"
          required
          placeholder="New task..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input type="date" name="dueDate" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Add task
        </button>
      </form>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between rounded-md bg-slate-50 p-2 text-sm">
            <div>
              <p className={task.completed ? "text-slate-400 line-through" : ""}>{task.title}</p>
              {task.dueDate && <p className="text-xs text-slate-400">Due {formatDate(task.dueDate)}</p>}
            </div>
            {!task.completed && (
              <form action={completeTaskAction}>
                <input type="hidden" name="taskId" value={task.id} />
                {contactId && <input type="hidden" name="contactId" value={contactId} />}
                {dealId && <input type="hidden" name="dealId" value={dealId} />}
                <button type="submit" className="text-xs font-medium text-brand-600">
                  Mark done
                </button>
              </form>
            )}
          </li>
        ))}
        {tasks.length === 0 && <p className="text-sm text-slate-500">No tasks yet.</p>}
      </ul>
    </div>
  );
}
