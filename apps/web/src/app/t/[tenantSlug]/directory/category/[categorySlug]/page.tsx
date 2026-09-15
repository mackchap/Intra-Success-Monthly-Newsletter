import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { searchListings } from "@/lib/directory/listings";

export const dynamic = "force-dynamic";

export default async function DirectoryCategoryPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; categorySlug: string }>;
}) {
  const { tenantSlug, categorySlug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) notFound();

  const directory = await prisma.directory.findUnique({ where: { tenantId: tenant.id } });
  if (!directory) notFound();

  const category = await prisma.directoryCategory.findUnique({
    where: { directoryId_slug: { directoryId: directory.id, slug: categorySlug } },
  });
  if (!category) notFound();

  const listings = await searchListings({ directoryId: directory.id, categoryId: category.id });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm text-slate-500">
        <Link href={`/t/${tenantSlug}/directory`} className="text-brand-600">
          ← {directory.name}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{category.name}</h1>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/t/${tenantSlug}/directory/listings/${listing.slug}`}
            className="flex flex-col gap-1 rounded-lg border border-slate-200 p-5 hover:border-brand-500"
          >
            <h2 className="font-semibold">{listing.name}</h2>
            {listing.city && <p className="text-xs text-slate-400">{listing.city}</p>}
            {listing.description && <p className="text-sm text-slate-600">{listing.description}</p>}
          </Link>
        ))}
        {listings.length === 0 && <p className="text-sm text-slate-500">No listings in this category yet.</p>}
      </div>
    </main>
  );
}
