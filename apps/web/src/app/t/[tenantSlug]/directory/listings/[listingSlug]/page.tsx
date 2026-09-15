import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, ListingStatus } from "@platform/db";
import { auth } from "@/auth";
import { formatMoney } from "@/lib/format";
import { ConciergeChat } from "@/components/directory/concierge-chat";
import { claimListingAction, upgradeListingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; listingSlug: string }>;
}) {
  const { tenantSlug, listingSlug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const directory = await prisma.directory.findUnique({ where: { tenantId: tenant.id } });
  if (!directory) notFound();

  const [listing, session] = await Promise.all([
    prisma.listing.findUnique({
      where: { directoryId_slug: { directoryId: directory.id, slug: listingSlug } },
      include: { category: true },
    }),
    auth(),
  ]);
  if (!listing || listing.status !== ListingStatus.PUBLISHED) notFound();

  const isClaimedByViewer = session?.user && listing.claimedByUserId === session.user.id;
  const upgradeProducts = isClaimedByViewer
    ? await prisma.product.findMany({ where: { listingId: listing.id, type: "LISTING_UPGRADE" } })
    : [];

  const redirectTo = `/t/${tenantSlug}/directory/listings/${listingSlug}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm text-slate-500">
        <Link href={`/t/${tenantSlug}/directory`} className="text-brand-600">
          ← {directory.name}
        </Link>
      </p>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{listing.name}</h1>
          {listing.category && (
            <Link href={`/t/${tenantSlug}/directory/category/${listing.category.slug}`} className="text-sm text-brand-600">
              {listing.category.name}
            </Link>
          )}
        </div>
        {listing.tier !== "FREE" && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">{listing.tier}</span>
        )}
      </div>

      {listing.description && <p className="mt-4 text-slate-600">{listing.description}</p>}

      <dl className="mt-6 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {listing.address && (
          <div>
            <dt className="text-slate-400">Address</dt>
            <dd>
              {listing.address}
              {listing.city && `, ${listing.city}`}
              {listing.state && `, ${listing.state}`} {listing.postalCode}
            </dd>
          </div>
        )}
        {listing.phone && (
          <div>
            <dt className="text-slate-400">Phone</dt>
            <dd>{listing.phone}</dd>
          </div>
        )}
        {listing.website && (
          <div>
            <dt className="text-slate-400">Website</dt>
            <dd>
              <a href={listing.website} target="_blank" rel="noreferrer" className="text-brand-600">
                {listing.website}
              </a>
            </dd>
          </div>
        )}
        {listing.email && (
          <div>
            <dt className="text-slate-400">Email</dt>
            <dd>{listing.email}</dd>
          </div>
        )}
      </dl>

      <div className="mt-8 rounded-lg border border-slate-200 p-4">
        {listing.claimedByUserId ? (
          isClaimedByViewer ? (
            <div>
              <p className="text-sm font-medium text-green-700">You&apos;ve claimed this listing.</p>
              {upgradeProducts.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-sm text-slate-600">Upgrade your listing&apos;s visibility:</p>
                  {upgradeProducts.map((product) => (
                    <form key={product.id} action={upgradeListingAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <button
                        type="submit"
                        disabled={!product.stripePriceId}
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {product.name} — {formatMoney(product.priceCents, product.currency)}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">This listing has been claimed by its owner.</p>
          )
        ) : session?.user ? (
          <form action={claimListingAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="listingSlug" value={listingSlug} />
            <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
              Is this your business? Claim this listing
            </button>
          </form>
        ) : (
          <Link
            href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="text-sm font-medium text-brand-600"
          >
            Is this your business? Sign in to claim this listing
          </Link>
        )}
      </div>

      <div className="mt-12">
        <ConciergeChat tenantSlug={tenantSlug} />
      </div>
    </main>
  );
}
