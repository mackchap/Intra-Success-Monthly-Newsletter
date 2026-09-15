import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      course: { findUniqueOrThrow: vi.fn() },
      subscription: { findFirst: vi.fn() },
      enrollment: { upsert: vi.fn(), updateMany: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import {
  enrollInFreeCourse,
  enrollViaMembership,
  grantManualEnrollment,
  revokeMembershipEnrollments,
} from "./enrollment";
import { ValidationError } from "@/lib/crm/errors";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enrollInFreeCourse", () => {
  it("rejects a non-free course", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({ priceType: "PAID" } as never);

    await expect(enrollInFreeCourse("user_1", "course_1")).rejects.toThrow(ValidationError);
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("enrolls with source FREE for a free course", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({ priceType: "FREE" } as never);

    await enrollInFreeCourse("user_1", "course_1");

    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
        create: expect.objectContaining({ source: "FREE" }),
      }),
    );
  });
});

describe("enrollViaMembership", () => {
  it("rejects a course that isn't membership-tier", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({ priceType: "PAID" } as never);

    await expect(enrollViaMembership("user_1", "course_1")).rejects.toThrow(ValidationError);
  });

  it("rejects a user with no active/trialing subscription", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({
      priceType: "MEMBERSHIP",
      tenantId: "tenant_1",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

    await expect(enrollViaMembership("user_1", "course_1")).rejects.toThrow(ValidationError);
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("enrolls with source MEMBERSHIP when the user has an active subscription in the course's own tenant", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({
      priceType: "MEMBERSHIP",
      tenantId: "tenant_1",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: "sub_1" } as never);

    await enrollViaMembership("user_1", "course_1");

    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant_1" }) }),
    );
    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ source: "MEMBERSHIP" }) }),
    );
  });
});

describe("grantManualEnrollment", () => {
  it("enrolls with source MANUAL unconditionally", async () => {
    await grantManualEnrollment("user_1", "course_1");

    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ source: "MANUAL" }) }),
    );
  });
});

describe("revokeMembershipEnrollments", () => {
  it("revokes only active MEMBERSHIP-sourced enrollments for the user in the given tenant", async () => {
    await revokeMembershipEnrollments("user_1", "tenant_1");

    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", source: "MEMBERSHIP", status: "ACTIVE", course: { tenantId: "tenant_1" } },
      data: { status: "REVOKED", revokedAt: expect.any(Date) },
    });
  });
});
