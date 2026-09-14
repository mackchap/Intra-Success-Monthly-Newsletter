import { prisma } from "@platform/db";

const TRIAL_DAYS = 14;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "account";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  // Small tables, low contention (interactive account creation) — a loop is
  // simpler and clearer here than a retry-on-unique-constraint-violation.
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

// The "start your own business on this platform" path: creates a brand new
// Tenant, makes the requesting user its OWNER, starts a platform-subscription
// trial, and seeds a default CRM pipeline — the same starter pipeline shape
// packages/db/prisma/seed.ts gives the legacy default tenant.
export async function createTenantForUser({ userId, name }: { userId: string; name: string }) {
  const slug = await uniqueSlug(name);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  return prisma.tenant.create({
    data: {
      name,
      slug,
      memberships: { create: { userId, role: "OWNER" } },
      platformSubscription: { create: { plan: "TRIAL", status: "TRIALING", trialEndsAt } },
      pipelines: {
        create: {
          name: "Default Pipeline",
          isDefault: true,
          stages: {
            create: [
              { name: "New", order: 0, probability: 10 },
              { name: "Qualified", order: 1, probability: 30 },
              { name: "Proposal", order: 2, probability: 60 },
              { name: "Won", order: 3, probability: 100, isWon: true },
              { name: "Lost", order: 4, probability: 0, isLost: true },
            ],
          },
        },
      },
    },
  });
}

export async function listMembershipsForUser(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });
}
