import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { formatMoney } from "@/lib/format";
import { createLessonAction, createModuleAction, grantEnrollmentAction, togglePublishedAction } from "../actions";

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  await requireAccountRole(tenantId, "ADMIN");

  const course = await prisma.course.findFirst({
    where: { id, tenantId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { downloads: true, quiz: true } } },
      },
      products: true,
    },
  });
  if (!course) notFound();

  const allLessons = course.modules.flatMap((m) => m.lessons);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{course.title}</h1>
          <p className="text-sm text-slate-500">
            /{course.slug} · {course.priceType === "FREE" ? "Free" : formatMoney(course.priceCents)}
          </p>
        </div>
        <form action={togglePublishedAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="published" value={String(course.published)} />
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
            {course.published ? "Unpublish" : "Publish"}
          </button>
        </form>
      </div>

      {course.products.length === 0 && course.priceType !== "FREE" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          No Stripe product links to this course yet. Create one on your connected Stripe account with metadata{" "}
          <code className="rounded bg-white px-1">type={course.priceType}</code> and{" "}
          <code className="rounded bg-white px-1">courseId={course.id}</code> so it can be purchased.
        </p>
      )}

      <section>
        <h2 className="font-medium">Modules</h2>
        <form action={createModuleAction} className="mt-2 flex gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="courseId" value={course.id} />
          <input name="title" required placeholder="Module title" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
            Add module
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-6">
          {course.modules.map((module) => (
            <div key={module.id} className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-medium">{module.title}</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id} className="text-sm text-slate-600">
                    {lesson.title} <span className="text-slate-400">({lesson.type})</span>
                    {lesson.dripDelayDays != null && (
                      <span className="text-slate-400"> · unlocks day {lesson.dripDelayDays}</span>
                    )}
                    {lesson.prerequisiteLessonId && <span className="text-slate-400"> · has prerequisite</span>}
                    {lesson.downloads.length > 0 && (
                      <span className="text-slate-400"> · {lesson.downloads.length} download(s)</span>
                    )}
                    {lesson.quiz && <span className="text-slate-400"> · has quiz</span>}
                  </li>
                ))}
                {module.lessons.length === 0 && <p className="text-sm text-slate-400">No lessons yet.</p>}
              </ul>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-brand-600">Add lesson</summary>
                <form action={createLessonAction} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="moduleId" value={module.id} />
                  <input name="title" required placeholder="Lesson title" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                  <select name="type" required className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                    <option value="VIDEO">Video</option>
                    <option value="TEXT">Text</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="QUIZ">Quiz</option>
                  </select>
                  <input
                    name="dripDelayDays"
                    type="number"
                    min="0"
                    placeholder="Unlock after N days (blank = immediate)"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <select name="prerequisiteLessonId" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                    <option value="">No prerequisite</option>
                    {allLessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="content"
                    placeholder="Text content (for TEXT lessons) / instructions"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
                  />
                  <select name="videoProvider" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                    <option value="">No video</option>
                    <option value="MUX">Mux</option>
                    <option value="VIMEO">Vimeo</option>
                  </select>
                  <input
                    name="videoId"
                    placeholder="Mux playback ID / Vimeo video ID"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    name="downloadFileName"
                    placeholder="Download file name (for DOWNLOAD lessons)"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    name="downloadFileUrl"
                    placeholder="Download file URL (R2/S3 public URL)"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <textarea
                    name="quizJson"
                    placeholder='Quiz questions JSON (for QUIZ lessons), e.g. [{"question":"...","options":["a","b"],"correctIndex":0}]'
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:col-span-2"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white sm:col-span-2 sm:w-fit"
                  >
                    Add lesson
                  </button>
                </form>
              </details>
            </div>
          ))}
          {course.modules.length === 0 && <p className="text-sm text-slate-500">No modules yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-medium">Grant access</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manually enroll a user (support cases, comps) — bypasses payment/membership checks.
        </p>
        <form action={grantEnrollmentAction} className="mt-2 flex gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="courseId" value={course.id} />
          <input
            name="email"
            type="email"
            required
            placeholder="student@example.com"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
            Grant enrollment
          </button>
        </form>
      </section>
    </div>
  );
}
