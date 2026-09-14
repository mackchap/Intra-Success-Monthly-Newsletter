import Link from "next/link";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { formatMoney } from "@/lib/format";
import { createCourseAction } from "./actions";

export default async function AdminCoursesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAccountRole(tenantId, "ADMIN");

  const courses = await prisma.course.findMany({
    where: { tenantId },
    include: { _count: { select: { modules: true, enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Courses</h1>

      <form
        action={createCourseAction}
        className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-5"
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input name="title" required placeholder="Course title" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="slug" required placeholder="url-slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="priceType" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="FREE">Free</option>
          <option value="PAID">Paid (one-time)</option>
          <option value="MEMBERSHIP">Membership</option>
        </select>
        <input
          name="priceDollars"
          type="number"
          step="0.01"
          min="0"
          placeholder="Price ($)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
          Create course
        </button>
        <textarea
          name="description"
          placeholder="Description"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-5"
        />
      </form>

      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Title</th>
            <th className="py-2">Price</th>
            <th className="py-2">Modules</th>
            <th className="py-2">Enrolled</th>
            <th className="py-2">Published</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id} className="border-t border-slate-100">
              <td className="py-2">
                <Link href={`/a/${tenantId}/admin/courses/${course.id}`} className="font-medium text-brand-600">
                  {course.title}
                </Link>
              </td>
              <td className="py-2">
                {course.priceType === "FREE" ? "Free" : formatMoney(course.priceCents)}
                {course.priceType === "MEMBERSHIP" ? " /mo" : ""}
              </td>
              <td className="py-2">{course._count.modules}</td>
              <td className="py-2">{course._count.enrollments}</td>
              <td className="py-2">{course.published ? "✅" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {courses.length === 0 && <p className="mt-4 text-sm text-slate-500">No courses yet.</p>}
    </div>
  );
}
