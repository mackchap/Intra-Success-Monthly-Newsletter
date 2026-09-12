import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { auth } from "@/auth";
import { formatMoney } from "@/lib/format";
import { buyProductAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, session] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { course: true } }),
    auth(),
  ]);

  if (!product) notFound();

  const isSubscription = product.type === "MEMBERSHIP";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        {product.course && <p className="text-sm text-slate-500">Includes: {product.course.title}</p>}
      </div>
      <p className="text-3xl font-bold">
        {formatMoney(product.priceCents, product.currency)}
        {isSubscription && <span className="text-base font-normal text-slate-500"> /month</span>}
      </p>

      {!product.stripePriceId && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          This product hasn&apos;t synced from Stripe yet — it needs a live Price before it can be purchased.
        </p>
      )}

      {session?.user ? (
        <form action={buyProductAction}>
          <input type="hidden" name="productId" value={product.id} />
          <button
            type="submit"
            disabled={!product.stripePriceId}
            className="w-full rounded-md bg-brand-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {isSubscription ? "Subscribe" : "Buy now"}
          </button>
        </form>
      ) : (
        <a
          href="/login"
          className="w-full rounded-md bg-brand-600 px-4 py-3 text-center font-medium text-white"
        >
          Sign in to purchase
        </a>
      )}
    </main>
  );
}
