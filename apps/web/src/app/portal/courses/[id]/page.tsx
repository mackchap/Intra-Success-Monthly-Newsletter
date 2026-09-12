import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { requireSession } from "@/lib/require-auth";
import { canAccessLesson } from "@/lib/academy/access";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortalCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const course = await prisma.course.findUnique({
    where: { id },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  if (!course) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") notFound();

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const [progressRows, certificate, accessResults] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) } },
    }),
    prisma.certificate.findUnique({ where: { userId_courseId: { userId: session.user.id, courseId: course.id } } }),
    Promise.all(allLessons.map((l) => canAccessLesson(session.user.id, l.id))),
  ]);

  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));
  const accessByLesson = new Map(allLessons.map((l, i) => [l.id, accessResults[i]]));

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">{course.title}</h1>

      {certificate && (
        <a
          href={`/api/certificates/${certificate.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          🎓 Course complete — download your certificate
        </a>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {course.modules.map((module) => (
          <div key={module.id}>
            <h2 className="font-medium">{module.title}</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {module.lessons.map((lesson) => {
                const progress = progressByLesson.get(lesson.id);
                const access = accessByLesson.get(lesson.id);
                const locked = !access?.allowed;
                return (
                  <li key={lesson.id}>
                    {locked ? (
                      <span className="flex items-center gap-2 rounded-md p-2 text-sm text-slate-400">
                        🔒 {lesson.title}
                        {access && !access.allowed && access.reason === "drip_locked" && (
                          <span>· unlocks {formatDate(access.unlocksAt)}</span>
                        )}
                        {access && !access.allowed && access.reason === "prerequisite_incomplete" && (
                          <span>· complete the prerequisite lesson first</span>
                        )}
                      </span>
                    ) : (
                      <Link
                        href={`/portal/courses/${course.id}/lessons/${lesson.id}`}
                        className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-slate-50"
                      >
                        {progress?.completed ? "✅" : "▶️"} {lesson.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
