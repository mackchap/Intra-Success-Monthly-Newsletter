import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      task: { create: vi.fn(), update: vi.fn() },
      activity: { create: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import { completeTask, createTask } from "./tasks";

describe("createTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task and logs a TASK_CREATED activity", async () => {
    vi.mocked(prisma.task.create).mockResolvedValue({ id: "task-1", title: "Follow up" } as never);

    await createTask({ title: "Follow up", contactId: "contact-1", actorId: "user-1" });

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "TASK_CREATED",
        contactId: "contact-1",
        metadata: { taskId: "task-1", title: "Follow up" },
      }),
    });
  });

  it("allows a task with no contact/deal attachment (general task)", async () => {
    vi.mocked(prisma.task.create).mockResolvedValue({ id: "task-2", title: "Review pipeline" } as never);

    await createTask({ title: "Review pipeline", actorId: "user-1" });

    expect(prisma.task.create).toHaveBeenCalled();
    expect(prisma.activity.create).toHaveBeenCalled();
  });
});

describe("completeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a task completed and logs a TASK_COMPLETED activity", async () => {
    vi.mocked(prisma.task.update).mockResolvedValue({
      id: "task-1",
      title: "Follow up",
      contactId: "contact-1",
      dealId: null,
      completed: true,
    } as never);

    await completeTask("task-1", "user-1");

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { completed: true, completedAt: expect.any(Date) },
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "TASK_COMPLETED", contactId: "contact-1" }),
    });
  });
});
