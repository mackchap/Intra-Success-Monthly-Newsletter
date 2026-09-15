import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      listing: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import { ValidationError } from "@/lib/crm/errors";
import { claimListing, createListing, searchListings, setListingStatus, updateListing, upgradeListingTier } from "./listings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createListing", () => {
  it("creates a listing with the given fields", async () => {
    await createListing({
      tenantId: "tenant_1",
      directoryId: "dir_1",
      name: "Joe's Diner",
      slug: "joes-diner",
      city: "Springfield",
    });

    expect(prisma.listing.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant_1",
        directoryId: "dir_1",
        name: "Joe's Diner",
        slug: "joes-diner",
        city: "Springfield",
      },
    });
  });
});

describe("updateListing", () => {
  it("updates the given fields", async () => {
    await updateListing("listing_1", { name: "Joe's Diner & Grill" });

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: "listing_1" },
      data: { name: "Joe's Diner & Grill" },
    });
  });
});

describe("setListingStatus", () => {
  it("updates the listing's status", async () => {
    await setListingStatus("listing_1", "UNPUBLISHED");

    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: "listing_1" }, data: { status: "UNPUBLISHED" } });
  });
});

describe("claimListing", () => {
  it("links the listing to the claiming user", async () => {
    vi.mocked(prisma.listing.findUniqueOrThrow).mockResolvedValue({ id: "listing_1", claimedByUserId: null } as never);
    vi.mocked(prisma.listing.update).mockResolvedValue({ id: "listing_1", claimedByUserId: "user_1" } as never);

    const result = await claimListing("listing_1", "user_1");

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: "listing_1" },
      data: { claimedByUserId: "user_1", claimedAt: expect.any(Date) },
    });
    expect(result).toEqual({ id: "listing_1", claimedByUserId: "user_1" });
  });

  it("is idempotent if the same user re-claims it", async () => {
    vi.mocked(prisma.listing.findUniqueOrThrow).mockResolvedValue({
      id: "listing_1",
      claimedByUserId: "user_1",
    } as never);

    await claimListing("listing_1", "user_1");

    expect(prisma.listing.update).not.toHaveBeenCalled();
  });

  it("refuses to reassign a listing already claimed by someone else", async () => {
    vi.mocked(prisma.listing.findUniqueOrThrow).mockResolvedValue({
      id: "listing_1",
      claimedByUserId: "user_other",
    } as never);

    await expect(claimListing("listing_1", "user_1")).rejects.toThrow(ValidationError);
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });
});

describe("upgradeListingTier", () => {
  it("updates the listing's tier", async () => {
    await upgradeListingTier("listing_1", "PREMIUM");

    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: "listing_1" }, data: { tier: "PREMIUM" } });
  });
});

describe("searchListings", () => {
  it("only returns PUBLISHED listings scoped to the directory when there's no query", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValue([]);

    await searchListings({ directoryId: "dir_1" });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { directoryId: "dir_1", status: "PUBLISHED", categoryId: undefined },
      }),
    );
  });

  it("searches name/description/city case-insensitively when a query is given", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValue([]);

    await searchListings({ directoryId: "dir_1", query: "coffee" });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "coffee", mode: "insensitive" } },
            { description: { contains: "coffee", mode: "insensitive" } },
            { city: { contains: "coffee", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("scopes to a category when given", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValue([]);

    await searchListings({ directoryId: "dir_1", categoryId: "cat_1" });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ categoryId: "cat_1" }) }),
    );
  });
});
