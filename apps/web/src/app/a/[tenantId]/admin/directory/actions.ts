"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, ListingStatus } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { createCategory, moveCategory, removeCategory, updateDirectorySettings } from "@/lib/directory/directories";
import { createListing, setListingStatus, updateListing } from "@/lib/directory/listings";
import { str } from "@/lib/form-data";

// Every action re-derives tenantId from a hidden form field, re-verifies the
// caller's role, and (for anything touching an existing row) confirms that
// row actually belongs to this tenant's directory — same defense-in-depth
// posture as every other tenant-admin module since Phase 9.

async function requireDirectoryInTenant(directoryId: string, tenantId: string) {
  return prisma.directory.findFirstOrThrow({ where: { id: directoryId, tenantId } });
}

async function requireListingInTenant(listingId: string, tenantId: string) {
  return prisma.listing.findFirstOrThrow({ where: { id: listingId, tenantId } });
}

export async function updateDirectorySettingsAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const directoryId = str(formData, "directoryId");
  const name = str(formData, "name");
  if (!directoryId || !name) throw new Error("directoryId and name are required.");
  await requireDirectoryInTenant(directoryId, tenantId);

  await updateDirectorySettings(directoryId, { name, description: str(formData, "description") });
  revalidatePath(`/a/${tenantId}/admin/directory`);
}

export async function createCategoryAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const directoryId = str(formData, "directoryId");
  const name = str(formData, "name");
  const slug = str(formData, "slug");
  if (!directoryId || !name || !slug) throw new Error("name and slug are required.");
  await requireDirectoryInTenant(directoryId, tenantId);

  await createCategory({ directoryId, name, slug });
  revalidatePath(`/a/${tenantId}/admin/directory`);
}

export async function moveCategoryAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const categoryId = str(formData, "categoryId");
  const direction = str(formData, "direction");
  if (!categoryId || (direction !== "up" && direction !== "down")) {
    throw new Error("categoryId and a valid direction are required.");
  }
  const category = await prisma.directoryCategory.findUniqueOrThrow({ where: { id: categoryId } });
  await requireDirectoryInTenant(category.directoryId, tenantId);

  await moveCategory(categoryId, direction);
  revalidatePath(`/a/${tenantId}/admin/directory`);
}

export async function removeCategoryAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const categoryId = str(formData, "categoryId");
  if (!categoryId) throw new Error("categoryId is required.");
  const category = await prisma.directoryCategory.findUniqueOrThrow({ where: { id: categoryId } });
  await requireDirectoryInTenant(category.directoryId, tenantId);

  await removeCategory(categoryId);
  revalidatePath(`/a/${tenantId}/admin/directory`);
}

export async function createListingAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const directoryId = str(formData, "directoryId");
  const name = str(formData, "name");
  const slug = str(formData, "slug");
  if (!directoryId || !name || !slug) throw new Error("name and slug are required.");
  await requireDirectoryInTenant(directoryId, tenantId);

  const listing = await createListing({
    tenantId,
    directoryId,
    name,
    slug,
    description: str(formData, "description"),
    address: str(formData, "address"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    postalCode: str(formData, "postalCode"),
    phone: str(formData, "phone"),
    website: str(formData, "website"),
    email: str(formData, "email"),
    categoryId: str(formData, "categoryId"),
  });

  revalidatePath(`/a/${tenantId}/admin/directory/listings`);
  redirect(`/a/${tenantId}/admin/directory/listings/${listing.id}`);
}

export async function updateListingAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const listingId = str(formData, "listingId");
  const name = str(formData, "name");
  if (!listingId || !name) throw new Error("listingId and name are required.");
  await requireListingInTenant(listingId, tenantId);

  await updateListing(listingId, {
    name,
    description: str(formData, "description"),
    address: str(formData, "address"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    postalCode: str(formData, "postalCode"),
    phone: str(formData, "phone"),
    website: str(formData, "website"),
    email: str(formData, "email"),
    categoryId: str(formData, "categoryId"),
  });

  revalidatePath(`/a/${tenantId}/admin/directory/listings/${listingId}`);
}

export async function setListingStatusAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const listingId = str(formData, "listingId");
  const status = str(formData, "status");
  if (!listingId || !status) throw new Error("listingId and status are required.");
  await requireListingInTenant(listingId, tenantId);

  await setListingStatus(listingId, status as ListingStatus);
  revalidatePath(`/a/${tenantId}/admin/directory/listings/${listingId}`);
  revalidatePath(`/a/${tenantId}/admin/directory/listings`);
}
