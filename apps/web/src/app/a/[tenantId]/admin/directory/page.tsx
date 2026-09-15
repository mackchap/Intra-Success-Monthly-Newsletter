import Link from "next/link";
import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { getOrCreateDirectory } from "@/lib/directory/directories";
import { createCategoryAction, moveCategoryAction, removeCategoryAction, updateDirectorySettingsAction } from "./actions";

export default async function AdminDirectoryPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAccountRole(tenantId, "ADMIN");

  const [directory, tenant] = await Promise.all([
    getOrCreateDirectory(tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { slug: true } }),
  ]);
  const categories = await prisma.directoryCategory.findMany({
    where: { directoryId: directory.id },
    orderBy: { order: "asc" },
    include: { _count: { select: { listings: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Directory</h1>
          <p className="mt-1 text-sm text-slate-500">
            A local-business directory visitors can browse and search — live at{" "}
            <Link href={`/t/${tenant.slug}/directory`} target="_blank" className="text-brand-600">
              /t/{tenant.slug}/directory ↗
            </Link>
          </p>
        </div>
        <Link href={`/a/${tenantId}/admin/directory/listings`} className="text-sm font-medium text-brand-600">
          Manage listings →
        </Link>
      </div>

      <section>
        <h2 className="font-medium">Settings</h2>
        <form
          action={updateDirectorySettingsAction}
          className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="directoryId" value={directory.id} />
          <input
            name="name"
            required
            defaultValue={directory.name}
            placeholder="Directory name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="description"
            defaultValue={directory.description ?? ""}
            placeholder="Short description"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="self-start rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
            Save settings
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-medium">Categories</h2>
        <form action={createCategoryAction} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="directoryId" value={directory.id} />
          <input name="name" required placeholder="Category name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="slug" required placeholder="url-slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
            Add category
          </button>
        </form>

        <ul className="mt-4 flex flex-col gap-2">
          {categories.map((category, index) => (
            <li key={category.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
              <span>
                {category.name} <span className="text-slate-400">({category._count.listings} listings)</span>
              </span>
              <span className="flex items-center gap-2">
                <form action={moveCategoryAction}>
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" className="text-xs text-slate-500" disabled={index === 0}>
                    ↑
                  </button>
                </form>
                <form action={moveCategoryAction}>
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" className="text-xs text-slate-500" disabled={index === categories.length - 1}>
                    ↓
                  </button>
                </form>
                <form action={removeCategoryAction}>
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <button type="submit" className="text-xs text-red-600">
                    Remove
                  </button>
                </form>
              </span>
            </li>
          ))}
          {categories.length === 0 && <p className="mt-2 text-sm text-slate-500">No categories yet.</p>}
        </ul>
      </section>
    </div>
  );
}
