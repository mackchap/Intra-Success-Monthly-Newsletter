import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { searchListings } from "@/lib/directory/listings";
import { ConciergeChat } from "@/components/directory/concierge-chat";

export const dynamic = "force-dynamic";

export default async function DirectoryHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenantSlug } = await params;
  const { q } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const directory = await prisma.directory.findUnique({ where: { tenantId: tenant.id } });
  if (!directory) notFound();

  const [categories, listings] = await Promise.all([
    prisma.directoryCategory.findMany({
      where: { directoryId: directory.id },
      orderBy: { order: "asc" },
      include: { _count: { select: { listings: { where: { status: "PUBLISHED" } } } } },
    }),
    q ? searchListings({ directoryId: directory.id, query: q }) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">{directory.name}</h1>
      {directory.description && <p className="mt-2 text-slate-600">{directory.description}</p>}

      <form className="mt-8 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search businesses..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {q ? (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-slate-500">
            {listings.length} result{listings.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/t/${tenantSlug}/directory/listings/${listing.slug}`}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 p-5 hover:border-brand-500"
              >
                <h3 className="font-semibold">{listing.name}</h3>
                {listing.category && <p className="text-xs text-slate-400">{listing.category.name}</p>}
                {listing.description && <p className="text-sm text-slate-600">{listing.description}</p>}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-10">
          <h2 className="font-medium">Browse by category</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/t/${tenantSlug}/directory/category/${category.slug}`}
                className="rounded-lg border border-slate-200 p-4 hover:border-brand-500"
              >
                <p className="font-medium">{category.name}</p>
                <p className="text-xs text-slate-400">{category._count.listings} listings</p>
              </Link>
            ))}
            {categories.length === 0 && <p className="text-sm text-slate-500">No categories yet.</p>}
          </div>
        </div>
      )}

      <div className="mt-12">
        <ConciergeChat tenantSlug={tenantSlug} />
      </div>
    </main>
  );
}
