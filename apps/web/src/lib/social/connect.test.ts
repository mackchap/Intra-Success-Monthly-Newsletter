import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      socialAccount: { upsert: vi.fn(), findUnique: vi.fn() },
    },
  };
});

vi.mock("./crypto", () => ({
  encryptToken: vi.fn((plaintext: string) => `encrypted(${plaintext})`),
}));

vi.mock("./meta", () => ({
  exchangeCodeForUserToken: vi.fn(),
  exchangeForLongLivedToken: vi.fn(),
  listManagedPages: vi.fn(),
}));

import { prisma } from "@platform/db";
import { exchangeCodeForUserToken, exchangeForLongLivedToken, listManagedPages } from "./meta";
import { connectMetaAccounts } from "./connect";
import { ValidationError } from "@/lib/crm/errors";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.socialAccount.findUnique).mockResolvedValue(null);
});

describe("connectMetaAccounts", () => {
  it("exchanges the code, then upserts a SocialAccount per page and per linked Instagram account", async () => {
    vi.mocked(exchangeCodeForUserToken).mockResolvedValue({ accessToken: "short", expiresIn: 3600 });
    vi.mocked(exchangeForLongLivedToken).mockResolvedValue({ accessToken: "long", expiresIn: 5184000 });
    vi.mocked(listManagedPages).mockResolvedValue([
      { id: "page_1", name: "My Page", accessToken: "page_token_1", instagramBusinessAccountId: "ig_1" },
      { id: "page_2", name: "No IG Page", accessToken: "page_token_2" },
    ]);

    const result = await connectMetaAccounts({
      tenantId: "tenant_1",
      code: "auth_code",
      redirectUri: "https://example.com/callback",
      connectedByUserId: "user_1",
    });

    expect(exchangeCodeForUserToken).toHaveBeenCalledWith({ code: "auth_code", redirectUri: "https://example.com/callback" });
    expect(exchangeForLongLivedToken).toHaveBeenCalledWith("short");
    expect(listManagedPages).toHaveBeenCalledWith("long");

    expect(prisma.socialAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { platform_externalId: { platform: "FACEBOOK", externalId: "page_1" } },
        create: expect.objectContaining({
          tenantId: "tenant_1",
          displayName: "My Page",
          accessTokenEncrypted: "encrypted(page_token_1)",
        }),
      }),
    );
    expect(prisma.socialAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { platform_externalId: { platform: "INSTAGRAM", externalId: "ig_1" } },
        create: expect.objectContaining({
          tenantId: "tenant_1",
          displayName: "My Page (Instagram)",
          accessTokenEncrypted: "encrypted(page_token_1)",
        }),
      }),
    );
    expect(prisma.socialAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { platform_externalId: { platform: "FACEBOOK", externalId: "page_2" } },
      }),
    );
    // page_2 has no Instagram account, so only 3 upserts total (not 4).
    expect(prisma.socialAccount.upsert).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ connectedPages: 2 });
  });

  it("returns zero connected pages when the user manages none", async () => {
    vi.mocked(exchangeCodeForUserToken).mockResolvedValue({ accessToken: "short", expiresIn: 3600 });
    vi.mocked(exchangeForLongLivedToken).mockResolvedValue({ accessToken: "long", expiresIn: 5184000 });
    vi.mocked(listManagedPages).mockResolvedValue([]);

    const result = await connectMetaAccounts({
      tenantId: "tenant_1",
      code: "c",
      redirectUri: "https://x.com",
      connectedByUserId: "u1",
    });

    expect(result).toEqual({ connectedPages: 0 });
    expect(prisma.socialAccount.upsert).not.toHaveBeenCalled();
  });

  it("refuses to reconnect a page that already belongs to a different tenant", async () => {
    vi.mocked(exchangeCodeForUserToken).mockResolvedValue({ accessToken: "short", expiresIn: 3600 });
    vi.mocked(exchangeForLongLivedToken).mockResolvedValue({ accessToken: "long", expiresIn: 5184000 });
    vi.mocked(listManagedPages).mockResolvedValue([
      { id: "page_1", name: "My Page", accessToken: "page_token_1" },
    ]);
    vi.mocked(prisma.socialAccount.findUnique).mockResolvedValue({ tenantId: "tenant_other" } as never);

    await expect(
      connectMetaAccounts({
        tenantId: "tenant_1",
        code: "auth_code",
        redirectUri: "https://example.com/callback",
        connectedByUserId: "user_1",
      }),
    ).rejects.toThrow(ValidationError);
    expect(prisma.socialAccount.upsert).not.toHaveBeenCalled();
  });
});
