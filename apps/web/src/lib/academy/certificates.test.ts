import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      course: { findUniqueOrThrow: vi.fn() },
      lessonProgress: { count: vi.fn() },
      certificate: { findUnique: vi.fn(), create: vi.fn() },
      enrollment: { findUnique: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import { checkAndIssueCertificate } from "./certificates";

function courseWithLessons(lessonIds: string[]) {
  return {
    id: "course_1",
    modules: [{ lessons: lessonIds.map((id) => ({ id })) }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAndIssueCertificate", () => {
  it("does not issue a certificate if not every lesson is complete", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(courseWithLessons(["l1", "l2"]) as never);
    vi.mocked(prisma.lessonProgress.count).mockResolvedValue(1);

    const result = await checkAndIssueCertificate("user_1", "course_1");

    expect(result).toBeNull();
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it("does nothing for a course with no lessons", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(courseWithLessons([]) as never);

    const result = await checkAndIssueCertificate("user_1", "course_1");

    expect(result).toBeNull();
    expect(prisma.lessonProgress.count).not.toHaveBeenCalled();
  });

  it("issues a certificate once every lesson is complete", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(courseWithLessons(["l1", "l2"]) as never);
    vi.mocked(prisma.lessonProgress.count).mockResolvedValue(2);
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: "enrollment_1" } as never);
    vi.mocked(prisma.certificate.create).mockResolvedValue({ id: "cert_1" } as never);

    const result = await checkAndIssueCertificate("user_1", "course_1");

    expect(prisma.certificate.create).toHaveBeenCalledWith({
      data: { userId: "user_1", courseId: "course_1", enrollmentId: "enrollment_1" },
    });
    expect(result).toEqual({ id: "cert_1" });
  });

  it("is idempotent — returns the existing certificate instead of creating a duplicate", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(courseWithLessons(["l1"]) as never);
    vi.mocked(prisma.lessonProgress.count).mockResolvedValue(1);
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue({ id: "cert_existing" } as never);

    const result = await checkAndIssueCertificate("user_1", "course_1");

    expect(prisma.certificate.create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "cert_existing" });
  });
});
