import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CourseCatalogPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const courses = await prisma.course.findMany({
    where: { tenantId: tenant.id, published: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Courses</h1>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/t/${tenantSlug}/courses/${course.slug}`}
            className="flex flex-col gap-2 rounded-lg border border-slate-200 p-5 hover:border-brand-500"
          >
            <h2 className="text-lg font-semibold">{course.title}</h2>
            {course.description && <p className="text-sm text-slate-600">{course.description}</p>}
            <p className="mt-auto text-sm font-medium text-brand-600">
              {course.priceType === "FREE" ? "Free" : formatMoney(course.priceCents)}
              {course.priceType === "MEMBERSHIP" ? " /month" : ""}
            </p>
          </Link>
        ))}
      </div>
      {courses.length === 0 && <p className="mt-8 text-sm text-slate-500">No courses published yet.</p>}
    </main>
  );
}
