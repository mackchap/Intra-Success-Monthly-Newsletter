"use server";

import { prisma } from "@platform/db";
import { requireSession } from "@/lib/require-auth";
import { canAccessLesson } from "@/lib/academy/access";
import { askStudentSupport, type ChatMessage } from "@/lib/agents/student-support";

// courseId is deliberately derived from the lesson server-side, not trusted
// from the client — same defense-in-depth reasoning as requireStaffSession:
// a Server Action is invocable directly, so it re-derives everything it
// needs to scope the search rather than trusting caller-supplied ids.
export async function askStudentSupportAction(
  lessonId: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const session = await requireSession();

  const access = await canAccessLesson(session.user.id, lessonId);
  if (!access.allowed) {
    throw new Error("You don't have access to this lesson.");
  }

  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });

  return askStudentSupport(lesson.module.courseId, history, userMessage);
}
