"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCourse, setCoursePublished, createModule, createLesson, addLessonDownload, setLessonQuiz } from "@/lib/academy/courses";
import { grantManualEnrollment } from "@/lib/academy/enrollment";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { str } from "@/lib/form-data";
import { prisma } from "@platform/db";

async function requireCourseInTenant(courseId: string, tenantId: string) {
  return prisma.course.findFirstOrThrow({ where: { id: courseId, tenantId } });
}

export async function createCourseAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const title = str(formData, "title");
  const slug = str(formData, "slug");
  const priceType = str(formData, "priceType");
  if (!title || !slug || !priceType) throw new Error("Title, slug, and price type are required.");

  const priceDollars = str(formData, "priceDollars");
  const course = await createCourse({
    tenantId,
    title,
    slug,
    description: str(formData, "description"),
    priceType: priceType as never,
    priceCents: priceDollars ? Math.round(Number.parseFloat(priceDollars) * 100) : 0,
  });

  revalidatePath(`/a/${tenantId}/admin/courses`);
  redirect(`/a/${tenantId}/admin/courses/${course.id}`);
}

export async function togglePublishedAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const courseId = str(formData, "courseId");
  const published = str(formData, "published") === "true";
  if (!courseId) throw new Error("courseId is required.");
  await requireCourseInTenant(courseId, tenantId);

  await setCoursePublished(courseId, !published);
  revalidatePath(`/a/${tenantId}/admin/courses/${courseId}`);
  revalidatePath(`/a/${tenantId}/admin/courses`);
}

export async function createModuleAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const courseId = str(formData, "courseId");
  const title = str(formData, "title");
  if (!courseId || !title) throw new Error("courseId and title are required.");
  await requireCourseInTenant(courseId, tenantId);

  await createModule(courseId, title);
  revalidatePath(`/a/${tenantId}/admin/courses/${courseId}`);
}

export async function createLessonAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const courseId = str(formData, "courseId");
  const moduleId = str(formData, "moduleId");
  const title = str(formData, "title");
  const type = str(formData, "type");
  if (!courseId || !moduleId || !title || !type) {
    throw new Error("moduleId, title, and type are required.");
  }
  await requireCourseInTenant(courseId, tenantId);

  const dripDelayDaysRaw = str(formData, "dripDelayDays");

  const lesson = await createLesson({
    moduleId,
    title,
    type: type as never,
    content: str(formData, "content"),
    videoProvider: str(formData, "videoProvider") as never,
    videoId: str(formData, "videoId"),
    dripDelayDays: dripDelayDaysRaw ? Number.parseInt(dripDelayDaysRaw, 10) : undefined,
    prerequisiteLessonId: str(formData, "prerequisiteLessonId"),
  });

  const downloadName = str(formData, "downloadFileName");
  const downloadUrl = str(formData, "downloadFileUrl");
  if (downloadName && downloadUrl) {
    await addLessonDownload(lesson.id, downloadName, downloadUrl);
  }

  const quizJson = str(formData, "quizJson");
  if (quizJson) {
    await setLessonQuiz(lesson.id, JSON.parse(quizJson));
  }

  revalidatePath(`/a/${tenantId}/admin/courses/${courseId}`);
}

export async function grantEnrollmentAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const courseId = str(formData, "courseId");
  const email = str(formData, "email");
  if (!courseId || !email) throw new Error("courseId and email are required.");
  await requireCourseInTenant(courseId, tenantId);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user found with email ${email}.`);

  await grantManualEnrollment(user.id, courseId);
  revalidatePath(`/a/${tenantId}/admin/courses/${courseId}`);
}
