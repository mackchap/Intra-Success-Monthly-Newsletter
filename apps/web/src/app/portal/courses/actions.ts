"use server";

import { revalidatePath } from "next/cache";
import { markLessonComplete } from "@/lib/academy/progress";
import { requireSession } from "@/lib/require-auth";

export async function markLessonCompleteAction(formData: FormData) {
  const session = await requireSession();

  const lessonId = formData.get("lessonId");
  const courseId = formData.get("courseId");
  if (typeof lessonId !== "string" || !lessonId) throw new Error("lessonId is required.");
  if (typeof courseId !== "string" || !courseId) throw new Error("courseId is required.");

  await markLessonComplete(session.user.id, lessonId);

  revalidatePath(`/portal/courses/${courseId}`);
  revalidatePath(`/portal/courses/${courseId}/lessons/${lessonId}`);
}
