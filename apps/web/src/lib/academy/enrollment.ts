import { prisma, CoursePriceType, EnrollmentSource, EnrollmentStatus, SubscriptionStatus } from "@platform/db";
import { ValidationError } from "@/lib/crm/errors";

// Enrollment.status = ACTIVE is the single source of truth for "can this
// user access this course," regardless of how they got in. Each source has
// exactly one code path that creates/activates it:
//   FREE            -> enrollInFreeCourse (student self-serve)
//   MEMBERSHIP      -> enrollViaMembership (student self-serve, requires an
//                      active/trialing Subscription)
//   STRIPE_PURCHASE -> Stripe webhook (checkout.session.completed, Phase 3)
//   MANUAL          -> grantManualEnrollment (admin/staff support action)

export async function enrollInFreeCourse(userId: string, courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.priceType !== CoursePriceType.FREE) {
    throw new ValidationError("This course isn't free — purchase or subscribe to access it.");
  }

  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { status: EnrollmentStatus.ACTIVE, revokedAt: null },
    create: { userId, courseId, source: EnrollmentSource.FREE },
  });
}

export async function enrollViaMembership(userId: string, courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.priceType !== CoursePriceType.MEMBERSHIP) {
    throw new ValidationError("This course doesn't require a membership.");
  }

  // Scoped to the course's own tenant — a subscription with Tenant A must
  // never grant access to Tenant B's membership course.
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      tenantId: course.tenantId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
    },
  });
  if (!activeSubscription) {
    throw new ValidationError("An active membership subscription is required for this course.");
  }

  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { status: EnrollmentStatus.ACTIVE, revokedAt: null },
    create: { userId, courseId, source: EnrollmentSource.MEMBERSHIP },
  });
}

export async function grantManualEnrollment(userId: string, courseId: string) {
  return prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { status: EnrollmentStatus.ACTIVE, revokedAt: null },
    create: { userId, courseId, source: EnrollmentSource.MANUAL },
  });
}

// Called when a membership subscription is canceled (Stripe webhook) — a
// MEMBERSHIP-tier course's access is only as good as the subscription that
// granted it, unlike a one-time STRIPE_PURCHASE enrollment which stays
// ACTIVE regardless of any later subscription changes. Scoped to the
// canceled subscription's own tenant — a Tenant A subscription cancellation
// must never revoke a Tenant B membership course the same user separately
// has access to.
export async function revokeMembershipEnrollments(userId: string, tenantId: string) {
  await prisma.enrollment.updateMany({
    where: {
      userId,
      source: EnrollmentSource.MEMBERSHIP,
      status: EnrollmentStatus.ACTIVE,
      course: { tenantId },
    },
    data: { status: EnrollmentStatus.REVOKED, revokedAt: new Date() },
  });
}
