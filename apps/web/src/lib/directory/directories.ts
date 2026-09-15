import { prisma } from "@platform/db";

// One Directory per Tenant (schema enforces this via a unique tenantId) —
// created lazily on first visit to the admin settings page rather than at
// tenant onboarding, since not every tenant wants a directory. Same "create
// lazily on first use" convention as a TenantCustomer's Stripe Customer.
export async function getOrCreateDirectory(tenantId: string) {
  const existing = await prisma.directory.findUnique({ where: { tenantId } });
  if (existing) return existing;

  return prisma.directory.create({
    data: { tenantId, name: "Local Business Directory" },
  });
}

export async function updateDirectorySettings(
  directoryId: string,
  input: { name: string; description?: string },
) {
  return prisma.directory.update({
    where: { id: directoryId },
    data: { name: input.name, description: input.description },
  });
}

// Order auto-assigned (append to the end), same pattern as Modules/Lessons/
// FunnelSteps — one less error-prone field for the admin to manage.
export async function createCategory(input: { directoryId: string; name: string; slug: string }) {
  const count = await prisma.directoryCategory.count({ where: { directoryId: input.directoryId } });
  return prisma.directoryCategory.create({
    data: { directoryId: input.directoryId, name: input.name, slug: input.slug, order: count },
  });
}

export async function moveCategory(categoryId: string, direction: "up" | "down") {
  const category = await prisma.directoryCategory.findUniqueOrThrow({ where: { id: categoryId } });
  const siblings = await prisma.directoryCategory.findMany({
    where: { directoryId: category.directoryId },
    orderBy: { order: "asc" },
  });

  const index = siblings.findIndex((c) => c.id === categoryId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) return category;

  const target = siblings[targetIndex];
  await prisma.directoryCategory.update({ where: { id: category.id }, data: { order: target.order } });
  return prisma.directoryCategory.update({ where: { id: target.id }, data: { order: category.order } });
}

export async function removeCategory(categoryId: string) {
  return prisma.directoryCategory.delete({ where: { id: categoryId } });
}
