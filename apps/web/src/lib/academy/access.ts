import { prisma, EnrollmentStatus } from "@platform/db";

export type LessonAccessResult =
  | { allowed: true }
  | { allowed: false; reason: "not_enrolled" }
  | { allowed: false; reason: "drip_locked"; unlocksAt: Date }
  | { allowed: false; reason: "prerequisite_incomplete"; prerequisiteLessonId: string }
  | { allowed: false; reason: "course_prerequisite_incomplete"; prerequisiteCourseId: string };

const DAY_MS = 24 * 60 * 60 * 1000;

// The single gate everything else (video/text/download/quiz rendering, the
// "mark complete" action) goes through. Order matters: enrollment first
// (cheapest, most common reason to be blocked), then drip, then
// prerequisites (lesson-level, then course-level).
export async function canAccessLesson(userId: string, lessonId: string): Promise<LessonAccessResult> {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { module: { include: { course: { include: { prerequisites: true } } } } },
  });
  const courseId = lesson.module.courseId;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
    return { allowed: false, reason: "not_enrolled" };
  }

  if (lesson.dripDelayDays != null) {
    const unlocksAt = new Date(enrollment.enrolledAt.getTime() + lesson.dripDelayDays * DAY_MS);
    if (unlocksAt.getTime() > Date.now()) {
      return { allowed: false, reason: "drip_locked", unlocksAt };
    }
  }

  if (lesson.prerequisiteLessonId) {
    const prereqProgress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson.prerequisiteLessonId } },
    });
    if (!prereqProgress?.completed) {
      return { allowed: false, reason: "prerequisite_incomplete", prerequisiteLessonId: lesson.prerequisiteLessonId };
    }
  }

  for (const prereqCourse of lesson.module.course.prerequisites) {
    const certificate = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId: prereqCourse.id } },
    });
    if (!certificate) {
      return { allowed: false, reason: "course_prerequisite_incomplete", prerequisiteCourseId: prereqCourse.id };
    }
  }

  return { allowed: true };
}
