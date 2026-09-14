import { prisma, ActivityType } from "@platform/db";

export interface CreateTaskInput {
  tenantId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  assignedToId?: string;
  contactId?: string;
  dealId?: string;
  actorId: string;
}

export async function createTask(input: CreateTaskInput) {
  const task = await prisma.task.create({
    data: {
      tenantId: input.tenantId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      assignedToId: input.assignedToId,
      contactId: input.contactId,
      dealId: input.dealId,
    },
  });

  await prisma.activity.create({
    data: {
      tenantId: input.tenantId,
      type: ActivityType.TASK_CREATED,
      actorId: input.actorId,
      contactId: input.contactId,
      dealId: input.dealId,
      metadata: { taskId: task.id, title: task.title },
    },
  });

  return task;
}

export async function completeTask(taskId: string, actorId: string) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { completed: true, completedAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      tenantId: task.tenantId,
      type: ActivityType.TASK_COMPLETED,
      actorId,
      contactId: task.contactId,
      dealId: task.dealId,
      metadata: { taskId: task.id, title: task.title },
    },
  });

  return task;
}
