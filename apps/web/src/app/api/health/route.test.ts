import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@platform/db";
import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when the database is reachable", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", db: "ok" });
  });

  it("returns 503 when the database is unreachable", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      db: "unreachable",
    });
  });
});
