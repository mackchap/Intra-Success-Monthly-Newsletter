"use server";

import { revalidatePath } from "next/cache";
import { createNote } from "@/lib/crm/notes";
import { createTask, completeTask } from "@/lib/crm/tasks";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { str } from "@/lib/form-data";

export async function addNoteAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { session } = await requireAccountRole(tenantId, "STAFF");

  const body = str(formData, "body");
  const contactId = str(formData, "contactId");
  const dealId = str(formData, "dealId");
  if (!body) return;

  await createNote({ tenantId, body, authorId: session.user.id, contactId, dealId });

  if (contactId) revalidatePath(`/a/${tenantId}/staff/contacts/${contactId}`);
  if (dealId) revalidatePath(`/a/${tenantId}/staff/deals/${dealId}`);
}

export async function addTaskAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { session } = await requireAccountRole(tenantId, "STAFF");

  const title = str(formData, "title");
  const contactId = str(formData, "contactId");
  const dealId = str(formData, "dealId");
  const dueDateRaw = str(formData, "dueDate");
  if (!title) return;

  await createTask({
    tenantId,
    title,
    contactId,
    dealId,
    dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    assignedToId: session.user.id,
    actorId: session.user.id,
  });

  if (contactId) revalidatePath(`/a/${tenantId}/staff/contacts/${contactId}`);
  if (dealId) revalidatePath(`/a/${tenantId}/staff/deals/${dealId}`);
  revalidatePath(`/a/${tenantId}/staff/tasks`);
}

export async function completeTaskAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { session } = await requireAccountRole(tenantId, "STAFF");

  const taskId = str(formData, "taskId");
  const contactId = str(formData, "contactId");
  const dealId = str(formData, "dealId");
  if (!taskId) return;

  await completeTask(taskId, session.user.id);

  if (contactId) revalidatePath(`/a/${tenantId}/staff/contacts/${contactId}`);
  if (dealId) revalidatePath(`/a/${tenantId}/staff/deals/${dealId}`);
  revalidatePath(`/a/${tenantId}/staff/tasks`);
}
