import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@platform/db";
import { auth } from "@/auth";
import { formatMoney } from "@/lib/format";
import { enrollFreeAction, enrollMembershipAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; slug: string }>;
}) {
  const { tenantSlug, slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const [course, session] = await Promise.all([
    prisma.course.findUnique({ where: { tenantId_slug: { tenantId: tenant.id, slug } }, include: { products: true } }),
    auth(),
  ]);
  if (!course || !course.published) notFound();

  const userId = session?.user?.id;

  const [enrollment, activeSubscription, membershipProduct] = await Promise.all([
    userId ? prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: course.id } } }) : null,
    userId
      ? prisma.subscription.findFirst({
          where: { userId, tenantId: tenant.id, status: { in: ["ACTIVE", "TRIALING"] } },
        })
      : null,
    course.priceType === "MEMBERSHIP" && !userId
      ? null
      : prisma.product.findFirst({ where: { tenantId: tenant.id, type: "MEMBERSHIP" } }),
  ]);

  const isEnrolled = enrollment?.status === "ACTIVE";
  const purchaseProduct = course.products.find((p) => p.stripePriceId);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        {course.description && <p className="mt-2 text-slate-600">{course.description}</p>}
      </div>
      <p className="text-2xl font-bold">
        {course.priceType === "FREE" ? "Free" : formatMoney(course.priceCents)}
        {course.priceType === "MEMBERSHIP" && <span className="text-base font-normal text-slate-500"> /month</span>}
      </p>

      {!session?.user ? (
        <Link href="/login" className="w-full rounded-md bg-brand-600 px-4 py-3 text-center font-medium text-white">
          Sign in to continue
        </Link>
      ) : isEnrolled ? (
        <a
          href={`/portal/courses/${course.id}`}
          className="w-full rounded-md bg-brand-600 px-4 py-3 text-center font-medium text-white"
        >
          Go to course
        </a>
      ) : course.priceType === "FREE" ? (
        <form action={enrollFreeAction}>
          <input type="hidden" name="courseId" value={course.id} />
          <button type="submit" className="w-full rounded-md bg-brand-600 px-4 py-3 font-medium text-white">
            Enroll for free
          </button>
        </form>
      ) : course.priceType === "MEMBERSHIP" ? (
        activeSubscription ? (
          <form action={enrollMembershipAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <button type="submit" className="w-full rounded-md bg-brand-600 px-4 py-3 font-medium text-white">
              Start course
            </button>
          </form>
        ) : membershipProduct ? (
          <a
            href={`/products/${membershipProduct.id}`}
            className="w-full rounded-md bg-brand-600 px-4 py-3 text-center font-medium text-white"
          >
            Subscribe to access
          </a>
        ) : (
          <p className="text-sm text-slate-500">A membership subscription is required — check back soon.</p>
        )
      ) : purchaseProduct ? (
        <a
          href={`/products/${purchaseProduct.id}`}
          className="w-full rounded-md bg-brand-600 px-4 py-3 text-center font-medium text-white"
        >
          Buy now
        </a>
      ) : (
        <p className="text-sm text-slate-500">Not available for purchase yet — check back soon.</p>
      )}
    </main>
  );
}
