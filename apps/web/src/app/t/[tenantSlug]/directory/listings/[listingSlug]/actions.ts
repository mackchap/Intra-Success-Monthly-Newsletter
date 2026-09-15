"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/require-auth";
import { claimListing } from "@/lib/directory/listings";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { str } from "@/lib/form-data";

export async function claimListingAction(formData: FormData) {
  const session = await requireSession();

  const listingId = str(formData, "listingId");
  const tenantSlug = str(formData, "tenantSlug");
  const listingSlug = str(formData, "listingSlug");
  if (!listingId || !tenantSlug || !listingSlug) {
    throw new Error("listingId, tenantSlug, and listingSlug are required.");
  }

  await claimListing(listingId, session.user.id);
  redirect(`/t/${tenantSlug}/directory/listings/${listingSlug}`);
}

// Reuses the exact same checkout path a course/membership purchase does
// (Phase 3, moved onto Stripe Connect in Phase 9) — a listing upgrade is
// just another Product, settling on this listing's own tenant's connected
// Stripe account. Only the already-claiming owner can buy an upgrade for
// their own listing.
export async function upgradeListingAction(formData: FormData) {
  const session = await requireSession();

  const productId = str(formData, "productId");
  if (!productId) throw new Error("productId is required.");

  const url = await createCheckoutSession({ productId, userId: session.user.id });
  redirect(url);
}
