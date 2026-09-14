import { prisma } from "@platform/db";

// Every module Phase 8 hasn't tenant-scoped yet (Funnels, Sequences,
// Academy, Marketing, Orders — see CLAUDE.md's Phase 8 section) still needs
// *some* tenantId wherever it touches a model Phase 8 DID scope (Contact,
// Deal, Activity). Until Phase 9 gives those modules real tenant awareness,
// they attach to this one pre-existing tenant — the same one the Phase 8
// migration backfilled all pre-existing CRM data onto, and the one
// packages/db/prisma/seed.ts creates on a fresh database.
const LEGACY_TENANT_SLUG = "intra-success-academy";

let cachedLegacyTenantId: string | null = null;

export async function getLegacyTenantId(): Promise<string> {
  if (cachedLegacyTenantId) return cachedLegacyTenantId;
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: LEGACY_TENANT_SLUG } });
  cachedLegacyTenantId = tenant.id;
  return tenant.id;
}
