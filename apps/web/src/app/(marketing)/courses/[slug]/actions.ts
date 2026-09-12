"use server";

import { redirect } from "next/navigation";
import { enrollInFreeCourse, enrollViaMembership } from "@/lib/academy/enrollment";
import { requireSession } from "@/lib/require-auth";

export async function enrollFreeAction(formData: FormData) {
  const session = await requireSession();
  const courseId = formData.get("courseId");
  if (typeof courseId !== "string" || !courseId) throw new Error("courseId is required.");

  await enrollInFreeCourse(session.user.id, courseId);
  redirect(`/portal/courses/${courseId}`);
}

export async function enrollMembershipAction(formData: FormData) {
  const session = await requireSession();
  const courseId = formData.get("courseId");
  if (typeof courseId !== "string" || !courseId) throw new Error("courseId is required.");

  await enrollViaMembership(session.user.id, courseId);
  redirect(`/portal/courses/${courseId}`);
}
