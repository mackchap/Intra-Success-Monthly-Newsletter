import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      lesson: { findUniqueOrThrow: vi.fn() },
      enrollment: { findUnique: vi.fn() },
      lessonProgress: { findUnique: vi.fn() },
      certificate: { findUnique: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import { canAccessLesson } from "./access";

function lessonFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "lesson_1",
    dripDelayDays: null,
    prerequisiteLessonId: null,
    module: {
      courseId: "course_1",
      course: { id: "course_1", prerequisites: [] },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canAccessLesson", () => {
  it("blocks access when there is no enrollment at all", async () => {
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(lessonFixture() as never);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result).toEqual({ allowed: false, reason: "not_enrolled" });
  });

  it("blocks access when the enrollment is REVOKED", async () => {
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(lessonFixture() as never);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      status: "REVOKED",
      enrolledAt: new Date(),
    } as never);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result).toEqual({ allowed: false, reason: "not_enrolled" });
  });

  it("blocks access to a lesson still inside its drip delay", async () => {
    const enrolledAt = new Date();
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(lessonFixture({ dripDelayDays: 7 }) as never);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ status: "ACTIVE", enrolledAt } as never);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result.allowed).toBe(false);
    if (!result.allowed && result.reason === "drip_locked") {
      const expectedUnlock = enrolledAt.getTime() + 7 * 24 * 60 * 60 * 1000;
      expect(result.unlocksAt.getTime()).toBe(expectedUnlock);
    } else {
      throw new Error(`Expected drip_locked, got ${JSON.stringify(result)}`);
    }
  });

  it("allows access once the drip delay has elapsed", async () => {
    const enrolledAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // enrolled 10 days ago
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(lessonFixture({ dripDelayDays: 7 }) as never);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ status: "ACTIVE", enrolledAt } as never);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result).toEqual({ allowed: true });
  });

  it("blocks access when the prerequisite lesson isn't completed", async () => {
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(
      lessonFixture({ prerequisiteLessonId: "lesson_0" }) as never,
    );
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date() } as never);
    vi.mocked(prisma.lessonProgress.findUnique).mockResolvedValue(null);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result).toEqual({ allowed: false, reason: "prerequisite_incomplete", prerequisiteLessonId: "lesson_0" });
  });

  it("allows access once the prerequisite lesson is completed", async () => {
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(
      lessonFixture({ prerequisiteLessonId: "lesson_0" }) as never,
    );
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date() } as never);
    vi.mocked(prisma.lessonProgress.findUnique).mockResolvedValue({ completed: true } as never);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result).toEqual({ allowed: true });
  });

  it("blocks access when a prerequisite course hasn't been completed (no certificate)", async () => {
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(
      lessonFixture({
        module: { courseId: "course_1", course: { id: "course_1", prerequisites: [{ id: "course_0" }] } },
      }) as never,
    );
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date() } as never);
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result).toEqual({
      allowed: false,
      reason: "course_prerequisite_incomplete",
      prerequisiteCourseId: "course_0",
    });
  });

  it("allows access once the prerequisite course's certificate exists", async () => {
    vi.mocked(prisma.lesson.findUniqueOrThrow).mockResolvedValue(
      lessonFixture({
        module: { courseId: "course_1", course: { id: "course_1", prerequisites: [{ id: "course_0" }] } },
      }) as never,
    );
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date() } as never);
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue({ id: "cert_1" } as never);

    const result = await canAccessLesson("user_1", "lesson_1");

    expect(result).toEqual({ allowed: true });
  });
});
