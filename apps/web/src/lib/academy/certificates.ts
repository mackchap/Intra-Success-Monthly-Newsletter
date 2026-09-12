import { prisma } from "@platform/db";

// Auto-issues a Certificate the moment every lesson in a course is marked
// complete. Idempotent — safe to call after every single lesson completion
// (that's how markLessonComplete uses it) without creating duplicates.
export async function checkAndIssueCertificate(userId: string, courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: { modules: { include: { lessons: { select: { id: true } } } } },
  });

  const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
  if (lessonIds.length === 0) {
    return null;
  }

  const completedCount = await prisma.lessonProgress.count({
    where: { userId, lessonId: { in: lessonIds }, completed: true },
  });
  if (completedCount < lessonIds.length) {
    return null;
  }

  const existing = await prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) {
    return existing;
  }

  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!enrollment) {
    // Shouldn't happen — access control requires an enrollment to progress
    // lessons in the first place — but don't blow up completion if it does.
    return null;
  }

  // certificateUrl is left null: the PDF is rendered on demand by
  // /api/certificates/[id]/pdf rather than pre-generated and uploaded to R2,
  // since we don't have R2 credentials to test that path in every
  // environment. Revisit if certificate PDFs need to be emailed/cached.
  return prisma.certificate.create({
    data: { userId, courseId, enrollmentId: enrollment.id },
  });
}
