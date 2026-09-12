import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      lessonProgress: { upsert: vi.fn() },
      lesson: { findUniqueOrThrow: vi.fn() },
    },
  };
});

vi.mock("./access", () => ({
  canAccessLesson: vi.fn(),
}));

vi.mock("./certificates", () => ({
  checkAndIssueCertificate: vi.fn(),
}));

import { prisma } from "@platform/db";
import { canAccessLesson } from "./access";
import { checkAndIssueCertificate } from "./certificates";
import { markLessonComplete, updateVideoProgress } from "./progress";
import { ValidationError } from "@/lib/crm/errors";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("markLessonComplete", () => {
  it("refuses to mark a lesson complete without access", async () => {
    vi.mocked(canAccessLesson).mockResolvedValue({ allowed: false, reason: "not_enrolled" });

    await expect(markLessonComplete("user_1", "lesson_1")).rejects.toThrow(ValidationError);
    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it("marks the lesson complete and checks for certificate issuance", async () => {
    vi.mocked(canAccessLesson).mockResolvedValue({ allowed: true });
    vi.mocked(prisma.lessonProgress.upsert).mockResolvedValue({ id: "progress_1" } as never);
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue({ module: { courseId: "course_1" } } as never);

    await markLessonComplete("user_1", "lesson_1");

    expect(prisma.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: "user_1", lessonId: "lesson_1" } },
        update: expect.objectContaining({ completed: true }),
      }),
    );
    expect(checkAndIssueCertificate).toHaveBeenCalledWith("user_1", "course_1");
  });
});

describe("updateVideoProgress", () => {
  it("refuses to update progress without access", async () => {
    vi.mocked(canAccessLesson).mockResolvedValue({ allowed: false, reason: "not_enrolled" });

    await expect(updateVideoProgress("user_1", "lesson_1", 42)).rejects.toThrow(ValidationError);
  });

  it("upserts the video progress seconds", async () => {
    vi.mocked(canAccessLesson).mockResolvedValue({ allowed: true });
    vi.mocked(prisma.lessonProgress.upsert).mockResolvedValue({ id: "progress_1" } as never);

    await updateVideoProgress("user_1", "lesson_1", 42);

    expect(prisma.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { videoProgressSeconds: 42 } }),
    );
  });
});
