import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      directory: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      directoryCategory: {
        count: vi.fn(),
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

import { prisma } from "@platform/db";
import { createCategory, getOrCreateDirectory, moveCategory, removeCategory, updateDirectorySettings } from "./directories";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreateDirectory", () => {
  it("returns the existing directory if one already exists for the tenant", async () => {
    vi.mocked(prisma.directory.findUnique).mockResolvedValue({ id: "dir_1", tenantId: "tenant_1" } as never);

    const result = await getOrCreateDirectory("tenant_1");

    expect(prisma.directory.create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "dir_1", tenantId: "tenant_1" });
  });

  it("creates a new directory with a default name if the tenant has none yet", async () => {
    vi.mocked(prisma.directory.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.directory.create).mockResolvedValue({ id: "dir_2", tenantId: "tenant_1" } as never);

    const result = await getOrCreateDirectory("tenant_1");

    expect(prisma.directory.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant_1", name: "Local Business Directory" },
    });
    expect(result).toEqual({ id: "dir_2", tenantId: "tenant_1" });
  });
});

describe("updateDirectorySettings", () => {
  it("updates the directory's name and description", async () => {
    await updateDirectorySettings("dir_1", { name: "Main Street Directory", description: "A local guide" });

    expect(prisma.directory.update).toHaveBeenCalledWith({
      where: { id: "dir_1" },
      data: { name: "Main Street Directory", description: "A local guide" },
    });
  });
});

describe("createCategory", () => {
  it("appends the new category at the end of the existing count", async () => {
    vi.mocked(prisma.directoryCategory.count).mockResolvedValue(2);

    await createCategory({ directoryId: "dir_1", name: "Restaurants", slug: "restaurants" });

    expect(prisma.directoryCategory.create).toHaveBeenCalledWith({
      data: { directoryId: "dir_1", name: "Restaurants", slug: "restaurants", order: 2 },
    });
  });
});

describe("moveCategory", () => {
  it("swaps order with the previous sibling when moving up", async () => {
    vi.mocked(prisma.directoryCategory.findUniqueOrThrow).mockResolvedValue({
      id: "cat_2",
      directoryId: "dir_1",
      order: 1,
    } as never);
    vi.mocked(prisma.directoryCategory.findMany).mockResolvedValue([
      { id: "cat_1", order: 0 },
      { id: "cat_2", order: 1 },
    ] as never);

    await moveCategory("cat_2", "up");

    expect(prisma.directoryCategory.update).toHaveBeenCalledWith({ where: { id: "cat_2" }, data: { order: 0 } });
    expect(prisma.directoryCategory.update).toHaveBeenCalledWith({ where: { id: "cat_1" }, data: { order: 1 } });
  });

  it("does nothing when already first and moving up", async () => {
    vi.mocked(prisma.directoryCategory.findUniqueOrThrow).mockResolvedValue({
      id: "cat_1",
      directoryId: "dir_1",
      order: 0,
    } as never);
    vi.mocked(prisma.directoryCategory.findMany).mockResolvedValue([{ id: "cat_1", order: 0 }] as never);

    const result = await moveCategory("cat_1", "up");

    expect(prisma.directoryCategory.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "cat_1", directoryId: "dir_1", order: 0 });
  });
});

describe("removeCategory", () => {
  it("deletes the category", async () => {
    await removeCategory("cat_1");

    expect(prisma.directoryCategory.delete).toHaveBeenCalledWith({ where: { id: "cat_1" } });
  });
});
