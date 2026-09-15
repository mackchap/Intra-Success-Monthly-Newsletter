import { prisma, ListingStatus, ListingTier } from "@platform/db";
import { ValidationError } from "@/lib/crm/errors";

export interface CreateListingInput {
  tenantId: string;
  directoryId: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  email?: string;
  categoryId?: string;
}

export async function createListing(input: CreateListingInput) {
  return prisma.listing.create({ data: input });
}

export interface UpdateListingInput {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  email?: string;
  categoryId?: string;
}

export async function updateListing(listingId: string, input: UpdateListingInput) {
  return prisma.listing.update({ where: { id: listingId }, data: input });
}

export async function setListingStatus(listingId: string, status: ListingStatus) {
  return prisma.listing.update({ where: { id: listingId }, data: { status } });
}

// A listing's real-world owner claims it once, linking it to their platform
// User — same "link an existing record to a User via an explicit action"
// pattern signup.ts already uses for a funnel-sourced Contact. Refuses if
// someone else already claimed it, rather than silently reassigning
// ownership (the same defensive posture Phase 9 added for a re-connected
// Meta account).
export async function claimListing(listingId: string, userId: string) {
  const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });

  if (listing.claimedByUserId && listing.claimedByUserId !== userId) {
    throw new ValidationError("This listing has already been claimed by someone else.");
  }
  if (listing.claimedByUserId === userId) {
    return listing;
  }

  return prisma.listing.update({
    where: { id: listingId },
    data: { claimedByUserId: userId, claimedAt: new Date() },
  });
}

// Bumps a listing's tier after a LISTING_UPGRADE purchase — called from the
// checkout.session.completed webhook handler, same "webhook drives module
// state" pattern as an Order paying for a course upserting an Enrollment.
export async function upgradeListingTier(listingId: string, tier: ListingTier) {
  return prisma.listing.update({ where: { id: listingId }, data: { tier } });
}

export interface SearchListingsInput {
  directoryId: string;
  query?: string;
  categoryId?: string;
}

// Deliberately simple case-insensitive substring search over name/
// description/city — no vector search/embeddings, same accepted approach as
// the student-support agent's search_course_content. Only ever surfaces
// PUBLISHED listings, since this backs both the public storefront search box
// and the concierge agent's one read tool.
export async function searchListings(input: SearchListingsInput) {
  const query = input.query?.trim();

  return prisma.listing.findMany({
    where: {
      directoryId: input.directoryId,
      status: ListingStatus.PUBLISHED,
      categoryId: input.categoryId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { category: true },
    orderBy: [{ tier: "desc" }, { name: "asc" }],
  });
}
