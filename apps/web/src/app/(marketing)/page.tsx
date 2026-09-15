import Link from "next/link";
import { prisma } from "@platform/db";
import { formatMoney } from "@/lib/format";
import { getLegacyTenantId, getLegacyTenantSlug } from "@/lib/accounts/legacy-tenant";

export const dynamic = "force-dynamic";

const VALUE_PROPS = [
  {
    title: "Practical frameworks",
    body: "Courses built around frameworks you can apply at work this week, not abstract theory.",
  },
  {
    title: "A community of intrapreneurs",
    body: "Learn alongside people driving change inside their own organizations, not just founders.",
  },
  {
    title: "Track your progress",
    body: "Structured courses with drip scheduling, completion certificates, and a dashboard that shows where you stand.",
  },
];

export default async function HomePage() {
  const tenantId = await getLegacyTenantId();
  const tenantSlug = await getLegacyTenantSlug();
  const courses = await prisma.course.findMany({
    where: { tenantId, published: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <main>
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          For intrapreneurs, not just entrepreneurs
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Master intrapreneurship</h1>
        <p className="max-w-xl text-lg text-slate-600">
          Actionable courses, frameworks, and coaching to help you innovate, influence, and drive lasting
          impact inside the organization you already work for.
        </p>
        <div className="flex gap-3">
          <Link href={`/t/${tenantSlug}/courses`} className="rounded-md bg-brand-600 px-5 py-3 font-medium text-white">
            Browse courses
          </Link>
          <Link href="/pricing" className="rounded-md border border-slate-300 px-5 py-3 font-medium">
            See pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {VALUE_PROPS.map((prop) => (
            <div key={prop.title}>
              <h2 className="font-semibold">{prop.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{prop.body}</p>
            </div>
          ))}
        </div>
      </section>

      {courses.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-bold">Featured courses</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/t/${tenantSlug}/courses/${course.slug}`}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-5 hover:border-brand-500"
              >
                <h3 className="font-semibold">{course.title}</h3>
                {course.description && <p className="text-sm text-slate-600">{course.description}</p>}
                <p className="mt-auto text-sm font-medium text-brand-600">
                  {course.priceType === "FREE" ? "Free" : formatMoney(course.priceCents)}
                  {course.priceType === "MEMBERSHIP" ? " /month" : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
