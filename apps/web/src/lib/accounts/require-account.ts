import { prisma, MembershipRole } from "@platform/db";
import { requireSession } from "@/lib/require-auth";

const ROLE_RANK: Record<MembershipRole, number> = {
  CUSTOMER: 0,
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
};

// The real tenant-access gate. middleware.ts only checks that *some* session
// exists for /a/:path* — it can't reach Prisma from the Edge runtime to know
// which tenants that session belongs to — so every Server Component, Server
// Action, and route handler touching tenant data calls this directly
// (defense in depth, same pattern requireStaffSession() already used for the
// old global role).
export async function requireAccountRole(tenantId: string, minRole: MembershipRole = "STAFF") {
  const session = await requireSession();

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });

  if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new Error("Forbidden: you don't have access to this account.");
  }

  return { session, membership };
}
