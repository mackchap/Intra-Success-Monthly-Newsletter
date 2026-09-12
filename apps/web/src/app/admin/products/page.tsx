import Link from "next/link";
import { prisma } from "@platform/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Products</h1>
      <p className="mt-2 text-sm text-slate-500">
        Products and prices are managed in the{" "}
        <a
          href="https://dashboard.stripe.com/test/products"
          target="_blank"
          rel="noreferrer"
          className="text-brand-600"
        >
          Stripe Dashboard
        </a>{" "}
        and sync in here automatically via webhook. To grant access to a course, add{" "}
        <code className="rounded bg-slate-100 px-1">type=COURSE</code> and{" "}
        <code className="rounded bg-slate-100 px-1">courseId=&lt;id&gt;</code> as metadata on the Stripe
        Product. Use <code className="rounded bg-slate-100 px-1">type=MEMBERSHIP</code> for a recurring
        subscription.
      </p>

      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Type</th>
            <th className="py-2">Price</th>
            <th className="py-2">Course</th>
            <th className="py-2">Synced</th>
            <th className="py-2">Link</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-t border-slate-100">
              <td className="py-2">{product.name}</td>
              <td className="py-2">{product.type}</td>
              <td className="py-2">{formatMoney(product.priceCents, product.currency)}</td>
              <td className="py-2">{product.course?.title ?? "—"}</td>
              <td className="py-2">{product.stripePriceId ? "✅" : "⏳ no price yet"}</td>
              <td className="py-2">
                <Link href={`/products/${product.id}`} className="text-brand-600">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          No products synced yet — create one in the Stripe Dashboard and it will appear here once its
          webhook events arrive.
        </p>
      )}
    </div>
  );
}
