"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCourse, setCoursePublished, createModule, createLesson, addLessonDownload, setLessonQuiz } from "@/lib/academy/courses";
import { grantManualEnrollment } from "@/lib/academy/enrollment";
import { requireStaffSession } from "@/lib/require-staff";
import { str } from "@/lib/form-data";
import { prisma } from "@platform/db";

export async function createCourseAction(formData: FormData) {
  await requireStaffSession();

  const title = str(formData, "title");
  const slug = str(formData, "slug");
  const priceType = str(formData, "priceType");
  if (!title || !slug || !priceType) throw new Error("Title, slug, and price type are required.");

  const priceDollars = str(formData, "priceDollars");
  const course = await createCourse({
    title,
    slug,
    description: str(formData, "description"),
    priceType: priceType as never,
    priceCents: priceDollars ? Math.round(Number.parseFloat(priceDollars) * 100) : 0,
  });

  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}

export async function togglePublishedAction(formData: FormData) {
  await requireStaffSession();

  const courseId = str(formData, "courseId");
  const published = str(formData, "published") === "true";
  if (!courseId) throw new Error("courseId is required.");

  await setCoursePublished(courseId, !published);
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
}

export async function createModuleAction(formData: FormData) {
  await requireStaffSession();

  const courseId = str(formData, "courseId");
  const title = str(formData, "title");
  if (!courseId || !title) throw new Error("courseId and title are required.");

  await createModule(courseId, title);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function createLessonAction(formData: FormData) {
  await requireStaffSession();

  const courseId = str(formData, "courseId");
  const moduleId = str(formData, "moduleId");
  const title = str(formData, "title");
  const type = str(formData, "type");
  if (!courseId || !moduleId || !title || !type) {
    throw new Error("moduleId, title, and type are required.");
  }

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

  revalidatePath(`/admin/courses/${courseId}`);
}

export async function grantEnrollmentAction(formData: FormData) {
  await requireStaffSession();

  const courseId = str(formData, "courseId");
  const email = str(formData, "email");
  if (!courseId || !email) throw new Error("courseId and email are required.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user found with email ${email}.`);

  await grantManualEnrollment(user.id, courseId);
  revalidatePath(`/admin/courses/${courseId}`);
}
