import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { setListingStatusAction, updateListingAction } from "../../actions";

export default async function AdminListingDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  await requireAccountRole(tenantId, "ADMIN");

  const [listing, categories] = await Promise.all([
    prisma.listing.findFirst({ where: { id, tenantId }, include: { claimedByUser: true } }),
    prisma.directoryCategory.findMany({ where: { directory: { tenantId } }, orderBy: { order: "asc" } }),
  ]);
  if (!listing) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">
            <Link href={`/a/${tenantId}/admin/directory/listings`} className="text-brand-600">
              ← Listings
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{listing.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {listing.tier} · {listing.status}
            {listing.claimedByUser && ` · claimed by ${listing.claimedByUser.email}`}
          </p>
        </div>
        <form action={setListingStatusAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="status" value={listing.status === "PUBLISHED" ? "UNPUBLISHED" : "PUBLISHED"} />
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
            {listing.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </button>
        </form>
      </div>

      <form
        action={updateListingAction}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="listingId" value={listing.id} />
        <input
          name="name"
          required
          defaultValue={listing.name}
          placeholder="Business name"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <textarea
          name="description"
          defaultValue={listing.description ?? ""}
          placeholder="Description"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          name="categoryId"
          defaultValue={listing.categoryId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          name="address"
          defaultValue={listing.address ?? ""}
          placeholder="Street address"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input name="city" defaultValue={listing.city ?? ""} placeholder="City" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="state" defaultValue={listing.state ?? ""} placeholder="State" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input
          name="postalCode"
          defaultValue={listing.postalCode ?? ""}
          placeholder="Postal code"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input name="phone" defaultValue={listing.phone ?? ""} placeholder="Phone" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input
          name="website"
          defaultValue={listing.website ?? ""}
          placeholder="Website URL"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input name="email" defaultValue={listing.email ?? ""} placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" className="self-start rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white sm:col-span-2 sm:w-fit">
          Save changes
        </button>
      </form>
    </div>
  );
}
