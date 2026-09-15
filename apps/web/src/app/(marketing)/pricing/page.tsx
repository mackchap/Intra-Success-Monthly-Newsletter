import Link from "next/link";
import { prisma } from "@platform/db";
import { formatMoney } from "@/lib/format";
import { getLegacyTenantId, getLegacyTenantSlug } from "@/lib/accounts/legacy-tenant";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const tenantId = await getLegacyTenantId();
  const tenantSlug = await getLegacyTenantSlug();
  const [courses, membershipProducts] = await Promise.all([
    prisma.course.findMany({
      where: { tenantId, published: true, priceType: { in: ["FREE", "PAID"] } },
      orderBy: { priceCents: "asc" },
    }),
    prisma.product.findMany({ where: { tenantId, type: "MEMBERSHIP" } }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-slate-600">Buy a single course, or subscribe for full access.</p>

      {membershipProducts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Membership</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {membershipProducts.map((product) => (
              <div key={product.id} className="rounded-lg border border-brand-500 p-6">
                <h3 className="font-semibold">{product.name}</h3>
                <p className="mt-2 text-3xl font-bold">
                  {formatMoney(product.priceCents)}
                  <span className="text-base font-normal text-slate-500"> /month</span>
                </p>
                <p className="mt-2 text-sm text-slate-600">Full access to every membership-tier course.</p>
                <Link
                  href={`/products/${product.id}`}
                  className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Subscribe
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Individual courses</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/t/${tenantSlug}/courses/${course.slug}`}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-5 hover:border-brand-500"
            >
              <h3 className="font-medium">{course.title}</h3>
              <p className="mt-auto text-lg font-semibold text-brand-600">
                {course.priceType === "FREE" ? "Free" : formatMoney(course.priceCents)}
              </p>
            </Link>
          ))}
        </div>
        {courses.length === 0 && <p className="mt-4 text-sm text-slate-500">No courses published yet.</p>}
      </section>
    </main>
  );
}
