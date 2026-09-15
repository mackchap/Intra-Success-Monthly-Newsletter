import { prisma, SocialPlatform } from "@platform/db";
import { encryptToken } from "./crypto";
import { exchangeCodeForUserToken, exchangeForLongLivedToken, listManagedPages } from "./meta";
import { ValidationError } from "@/lib/crm/errors";

export interface ConnectMetaAccountsInput {
  tenantId: string;
  code: string;
  redirectUri: string;
  connectedByUserId: string;
}

async function upsertSocialAccount(input: {
  tenantId: string;
  platform: SocialPlatform;
  externalId: string;
  displayName: string;
  accessToken: string;
  connectedByUserId: string;
}) {
  // A real Facebook Page/IG account can only ever belong to one tenant
  // (schema's @@unique([platform, externalId])) — but that constraint alone
  // would let a second tenant's OAuth connect silently reassign an existing
  // row's tenantId via upsert. Guard against that explicitly rather than
  // letting one business's page quietly disappear from another's dashboard.
  const existing = await prisma.socialAccount.findUnique({
    where: { platform_externalId: { platform: input.platform, externalId: input.externalId } },
  });
  if (existing && existing.tenantId !== input.tenantId) {
    throw new ValidationError(
      `This ${input.platform === SocialPlatform.INSTAGRAM ? "Instagram account" : "Facebook Page"} is already connected to a different business on this platform.`,
    );
  }

  await prisma.socialAccount.upsert({
    where: { platform_externalId: { platform: input.platform, externalId: input.externalId } },
    update: {
      displayName: input.displayName,
      accessTokenEncrypted: encryptToken(input.accessToken),
      disconnectedAt: null,
      connectedByUserId: input.connectedByUserId,
    },
    create: {
      tenantId: input.tenantId,
      platform: input.platform,
      externalId: input.externalId,
      displayName: input.displayName,
      accessTokenEncrypted: encryptToken(input.accessToken),
      connectedByUserId: input.connectedByUserId,
    },
  });
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
    await upsertSocialAccount({
      tenantId: input.tenantId,
      platform: SocialPlatform.FACEBOOK,
      externalId: page.id,
      displayName: page.name,
      accessToken: page.accessToken,
      connectedByUserId: input.connectedByUserId,
    });

    if (page.instagramBusinessAccountId) {
      await upsertSocialAccount({
        tenantId: input.tenantId,
        platform: SocialPlatform.INSTAGRAM,
        externalId: page.instagramBusinessAccountId,
        displayName: `${page.name} (Instagram)`,
        accessToken: page.accessToken,
        connectedByUserId: input.connectedByUserId,
      });
    }
  }

  return { connectedPages: pages.length };
}
