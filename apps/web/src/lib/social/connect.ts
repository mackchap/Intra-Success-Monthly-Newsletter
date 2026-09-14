import { prisma, SocialPlatform } from "@platform/db";
import { encryptToken } from "./crypto";
import { exchangeCodeForUserToken, exchangeForLongLivedToken, listManagedPages } from "./meta";

export interface ConnectMetaAccountsInput {
  code: string;
  redirectUri: string;
  connectedByUserId: string;
}

// Exchanges the OAuth code for a long-lived user token, then upserts a
// SocialAccount for every Facebook Page the user manages (and its linked
// Instagram Business account, if any) — pulled into its own function so the
// callback route stays a thin redirect and this is unit-testable with a
// mocked @platform/db and mocked lib/social/meta.
export async function connectMetaAccounts(input: ConnectMetaAccountsInput): Promise<{ connectedPages: number }> {
  const shortLived = await exchangeCodeForUserToken({ code: input.code, redirectUri: input.redirectUri });
  const longLived = await exchangeForLongLivedToken(shortLived.accessToken);
  const pages = await listManagedPages(longLived.accessToken);

  for (const page of pages) {
    await prisma.socialAccount.upsert({
      where: { platform_externalId: { platform: SocialPlatform.FACEBOOK, externalId: page.id } },
      update: {
        displayName: page.name,
        accessTokenEncrypted: encryptToken(page.accessToken),
        disconnectedAt: null,
        connectedByUserId: input.connectedByUserId,
      },
      create: {
        platform: SocialPlatform.FACEBOOK,
        externalId: page.id,
        displayName: page.name,
        accessTokenEncrypted: encryptToken(page.accessToken),
        connectedByUserId: input.connectedByUserId,
      },
    });

    if (page.instagramBusinessAccountId) {
      await prisma.socialAccount.upsert({
        where: {
          platform_externalId: { platform: SocialPlatform.INSTAGRAM, externalId: page.instagramBusinessAccountId },
        },
        update: {
          displayName: `${page.name} (Instagram)`,
          accessTokenEncrypted: encryptToken(page.accessToken),
          disconnectedAt: null,
          connectedByUserId: input.connectedByUserId,
        },
        create: {
          platform: SocialPlatform.INSTAGRAM,
          externalId: page.instagramBusinessAccountId,
          displayName: `${page.name} (Instagram)`,
          accessTokenEncrypted: encryptToken(page.accessToken),
          connectedByUserId: input.connectedByUserId,
        },
      });
    }
  }

  return { connectedPages: pages.length };
}
