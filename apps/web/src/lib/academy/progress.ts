import { prisma } from "@platform/db";
import { canAccessLesson } from "./access";
import { checkAndIssueCertificate } from "./certificates";
import { ValidationError } from "@/lib/crm/errors";

export async function markLessonComplete(userId: string, lessonId: string) {
  const access = await canAccessLesson(userId, lessonId);
  if (!access.allowed) {
    throw new ValidationError(`Cannot complete a lesson you don't have access to (${access.reason}).`);
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completed: true, completedAt: new Date() },
    create: { userId, lessonId, completed: true, completedAt: new Date() },
  });

  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  await checkAndIssueCertificate(userId, lesson.module.courseId);

  return progress;
}

export async function updateVideoProgress(userId: string, lessonId: string, videoProgressSeconds: number) {
  const access = await canAccessLesson(userId, lessonId);
  if (!access.allowed) {
    throw new ValidationError(`Cannot update progress on a lesson you don't have access to (${access.reason}).`);
  }

  return prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { videoProgressSeconds },
    create: { userId, lessonId, videoProgressSeconds },
  });
}
