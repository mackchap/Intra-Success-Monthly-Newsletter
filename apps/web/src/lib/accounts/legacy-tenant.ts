import { prisma, type Tenant } from "@platform/db";

// Phase 9 tenant-scoped Funnels/Academy/Marketing/Orders, so most callers
// that used to fall back to this no longer need to. What's left: the root
// `(marketing)` site (`/`, `/pricing`) is deliberately still "Intra Success
// Academy's own marketing site" (its featured courses, its pricing), not a
// generic cross-tenant page — see CLAUDE.md's Phase 9 section for why
// redesigning it into a true platform-wide marketing site (selling the
// platform itself, HighLevel-style) is a separate product decision, not a
// side effect of tenant-scoping data. This is the same tenant the Phase 8
// migration backfilled all pre-existing data onto, and the one
// packages/db/prisma/seed.ts creates on a fresh database.
const LEGACY_TENANT_SLUG = "intra-success-academy";

let cachedLegacyTenant: Pick<Tenant, "id" | "slug"> | null = null;

async function getLegacyTenant(): Promise<Pick<Tenant, "id" | "slug">> {
  if (cachedLegacyTenant) return cachedLegacyTenant;
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: LEGACY_TENANT_SLUG },
    select: { id: true, slug: true },
  });
  cachedLegacyTenant = tenant;
  return tenant;
}

export async function getLegacyTenantId(): Promise<string> {
  return (await getLegacyTenant()).id;
}

export async function getLegacyTenantSlug(): Promise<string> {
  return (await getLegacyTenant()).slug;
}
