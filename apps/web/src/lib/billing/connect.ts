import { prisma, StripeConnectStatus } from "@platform/db";
import { stripe } from "@/lib/stripe";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

// Standard Connect accounts (not Express/Custom) — the tenant manages their
// own Stripe dashboard, tax settings, and payout schedule directly, which
// matters once "tenant" means a real, separate business, not a division of
// ours. See CLAUDE.md's Phase 8 section for why Connect at all: a tenant's
// customers' money must never settle in the platform's own Stripe account.
export async function createConnectOnboardingLink(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  let stripeConnectAccountId = tenant.stripeConnectAccountId;
  if (!stripeConnectAccountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      metadata: { tenantId },
    });
    stripeConnectAccountId = account.id;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeConnectAccountId, stripeConnectStatus: StripeConnectStatus.PENDING },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeConnectAccountId,
    refresh_url: `${appUrl()}/api/billing/connect/start?tenantId=${tenantId}`,
    return_url: `${appUrl()}/api/billing/connect/callback?tenantId=${tenantId}`,
    type: "account_onboarding",
  });

  return accountLink.url;
}

// Called from the onboarding return_url (best-effort, since Stripe's own
// account.updated webhook — handled in webhook-handlers.ts — is the
// authoritative source once Connect webhooks are configured) and safe to
// call any time to refresh a Tenant's Connect status on demand.
export async function syncConnectAccountStatus(stripeConnectAccountId: string): Promise<void> {
  const account = await stripe.accounts.retrieve(stripeConnectAccountId);

  const status = account.charges_enabled
    ? StripeConnectStatus.ACTIVE
    : account.details_submitted
      ? StripeConnectStatus.PENDING
      : StripeConnectStatus.PENDING;

  await prisma.tenant.updateMany({
    where: { stripeConnectAccountId },
    data: { stripeConnectStatus: status, chargesEnabled: account.charges_enabled ?? false },
  });
}
