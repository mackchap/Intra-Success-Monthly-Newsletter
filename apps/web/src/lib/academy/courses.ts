import { prisma, CoursePriceType, LessonType, VideoProvider } from "@platform/db";

export interface CreateCourseInput {
  tenantId: string;
  title: string;
  slug: string;
  description?: string;
  priceType: CoursePriceType;
  priceCents: number;
}

export async function createCourse(input: CreateCourseInput) {
  return prisma.course.create({ data: input });
}

export async function setCoursePublished(courseId: string, published: boolean) {
  return prisma.course.update({ where: { id: courseId }, data: { published } });
}

// Orders are auto-assigned (append to the end) rather than typed by the
// admin — one less error-prone field, and reordering isn't needed yet.
export async function createModule(courseId: string, title: string) {
  const count = await prisma.module.count({ where: { courseId } });
  return prisma.module.create({ data: { courseId, title, order: count } });
}

export interface CreateLessonInput {
  moduleId: string;
  title: string;
  type: LessonType;
  content?: string;
  videoProvider?: VideoProvider;
  videoId?: string;
  dripDelayDays?: number;
  prerequisiteLessonId?: string;
}

export async function createLesson(input: CreateLessonInput) {
  const count = await prisma.lesson.count({ where: { moduleId: input.moduleId } });
  return prisma.lesson.create({
    data: {
      moduleId: input.moduleId,
      title: input.title,
      order: count,
      type: input.type,
      content: input.content,
      videoProvider: input.videoProvider,
      videoId: input.videoId,
      dripDelayDays: input.dripDelayDays,
      prerequisiteLessonId: input.prerequisiteLessonId,
    },
  });
}

export async function addLessonDownload(lessonId: string, fileName: string, fileUrl: string) {
  return prisma.lessonDownload.create({ data: { lessonId, fileName, fileUrl } });
}

export async function setLessonQuiz(lessonId: string, questions: unknown) {
  return prisma.quiz.upsert({
    where: { lessonId },
    update: { questions: questions as never },
    create: { lessonId, questions: questions as never },
  });
}
