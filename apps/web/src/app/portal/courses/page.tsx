import Link from "next/link";
import { prisma } from "@platform/db";
import { requireSession } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const session = await requireSession();

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { course: { include: { modules: { include: { lessons: { select: { id: true } } } } } } },
    orderBy: { enrolledAt: "desc" },
  });

  const lessonIdsByCourse = enrollments.map((e) => ({
    course: e.course,
    lessonIds: e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
  }));

  const completedCounts = await Promise.all(
    lessonIdsByCourse.map(({ lessonIds }) =>
      lessonIds.length === 0
        ? 0
        : prisma.lessonProgress.count({
            where: { userId: session.user.id, lessonId: { in: lessonIds }, completed: true },
          }),
    ),
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">My courses</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {lessonIdsByCourse.map(({ course, lessonIds }, i) => {
          const total = lessonIds.length;
          const completed = completedCounts[i];
          const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
          return (
            <li key={course.id}>
              <Link
                href={`/portal/courses/${course.id}`}
                className="block rounded-lg border border-slate-200 p-4 hover:border-brand-500"
              >
                <p className="font-medium">{course.title}</p>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {completed}/{total} lessons complete
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      {enrollments.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No enrolled courses yet.{" "}
          <Link href="/courses" className="text-brand-600">
            Browse courses
          </Link>
          .
        </p>
      )}
    </main>
  );
}
