import Link from "next/link";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { getOrCreateDirectory } from "@/lib/directory/directories";
import { createListingAction } from "../actions";

export default async function AdminListingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAccountRole(tenantId, "ADMIN");

  const directory = await getOrCreateDirectory(tenantId);
  const [listings, categories] = await Promise.all([
    prisma.listing.findMany({
      where: { directoryId: directory.id },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.directoryCategory.findMany({ where: { directoryId: directory.id }, orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href={`/a/${tenantId}/admin/directory`} className="text-brand-600">
            ← Directory
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Listings</h1>
      </div>

      <form
        action={createListingAction}
        className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-4 sm:grid-cols-3"
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="directoryId" value={directory.id} />
        <input name="name" required placeholder="Business name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="slug" required placeholder="url-slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="categoryId" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input name="city" placeholder="City" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="state" placeholder="State" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
          Add listing
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Category</th>
            <th className="py-2">City</th>
            <th className="py-2">Tier</th>
            <th className="py-2">Status</th>
            <th className="py-2">Claimed</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id} className="border-t border-slate-100">
              <td className="py-2">
                <Link href={`/a/${tenantId}/admin/directory/listings/${listing.id}`} className="font-medium text-brand-600">
                  {listing.name}
                </Link>
              </td>
              <td className="py-2">{listing.category?.name ?? "—"}</td>
              <td className="py-2">{listing.city ?? "—"}</td>
              <td className="py-2">{listing.tier}</td>
              <td className="py-2">{listing.status}</td>
              <td className="py-2">{listing.claimedByUserId ? "✅" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {listings.length === 0 && <p className="text-sm text-slate-500">No listings yet.</p>}
    </div>
  );
}
