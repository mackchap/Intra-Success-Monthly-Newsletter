"use server";

import { revalidatePath } from "next/cache";
import { createNote } from "@/lib/crm/notes";
import { createTask, completeTask } from "@/lib/crm/tasks";
import { requireStaffSession } from "@/lib/require-staff";

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function addNoteAction(formData: FormData) {
  const session = await requireStaffSession();

  const body = str(formData, "body");
  const contactId = str(formData, "contactId");
  const dealId = str(formData, "dealId");
  if (!body) return;

  await createNote({ body, authorId: session.user.id, contactId, dealId });

  if (contactId) revalidatePath(`/staff/contacts/${contactId}`);
  if (dealId) revalidatePath(`/staff/deals/${dealId}`);
}

export async function addTaskAction(formData: FormData) {
  const session = await requireStaffSession();

  const title = str(formData, "title");
  const contactId = str(formData, "contactId");
  const dealId = str(formData, "dealId");
  const dueDateRaw = str(formData, "dueDate");
  if (!title) return;

  await createTask({
    title,
    contactId,
    dealId,
    dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    assignedToId: session.user.id,
    actorId: session.user.id,
  });

  if (contactId) revalidatePath(`/staff/contacts/${contactId}`);
  if (dealId) revalidatePath(`/staff/deals/${dealId}`);
  revalidatePath("/staff/tasks");
}

export async function completeTaskAction(formData: FormData) {
  const session = await requireStaffSession();

  const taskId = str(formData, "taskId");
  const contactId = str(formData, "contactId");
  const dealId = str(formData, "dealId");
  if (!taskId) return;

  await completeTask(taskId, session.user.id);

  if (contactId) revalidatePath(`/staff/contacts/${contactId}`);
  if (dealId) revalidatePath(`/staff/deals/${dealId}`);
  revalidatePath("/staff/tasks");
}
