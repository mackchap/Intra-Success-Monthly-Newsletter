import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { requireSession } from "@/lib/require-auth";
import { canAccessLesson } from "@/lib/academy/access";
import { videoEmbedUrl } from "@/lib/academy/video-embed";
import { markLessonCompleteAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id: courseId, lessonId } = await params;
  const session = await requireSession();

  const access = await canAccessLesson(session.user.id, lessonId);
  if (!access.allowed) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-slate-600">
          {access.reason === "drip_locked" && `This lesson unlocks on ${access.unlocksAt.toLocaleDateString()}.`}
          {access.reason === "prerequisite_incomplete" && "Complete the prerequisite lesson first."}
          {access.reason === "course_prerequisite_incomplete" && "Complete the prerequisite course first."}
          {access.reason === "not_enrolled" && "You're not enrolled in this course."}
        </p>
        <Link href={`/portal/courses/${courseId}`} className="mt-4 inline-block text-brand-600">
          ← Back to course
        </Link>
      </main>
    );
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { downloads: true, quiz: true, module: { include: { course: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) notFound();

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
  });

  const embedUrl = videoEmbedUrl(lesson.videoProvider, lesson.videoId);
  const questions = (lesson.quiz?.questions as { question: string; options: string[] }[] | undefined) ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href={`/portal/courses/${courseId}`} className="text-sm text-brand-600">
        ← Back to course
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{lesson.title}</h1>

      {embedUrl && (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe src={embedUrl} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen />
        </div>
      )}

      {lesson.content && <div className="prose mt-6 whitespace-pre-wrap text-slate-700">{lesson.content}</div>}

      {lesson.downloads.length > 0 && (
        <div className="mt-6">
          <h2 className="font-medium">Downloads</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {lesson.downloads.map((download) => (
              <li key={download.id}>
                <a href={download.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600">
                  {download.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <h2 className="font-medium">Quiz</h2>
          {questions.map((q, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-3">
              <p className="text-sm font-medium">{q.question}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {q.options.map((option, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="radio" name={`q${i}`} disabled />
                    {option}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <form action={markLessonCompleteAction} className="mt-8">
        <input type="hidden" name="lessonId" value={lesson.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <button
          type="submit"
          disabled={progress?.completed}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {progress?.completed ? "✅ Completed" : "Mark complete"}
        </button>
      </form>
    </main>
  );
}
