import { auth } from "@/auth";

// Gates the legacy, not-yet-tenant-scoped `/admin/*` surfaces (Academy,
// Funnels, Marketing, Products, Sequences) — everything Phase 8 hasn't
// migrated onto Tenant/Membership yet (see CLAUDE.md's Phase 8 section).
// Until Phase 9 tenant-scopes those modules too, only platform admins (your
// own team) manage them; tenant-scoped CRM under /a/[tenantId]/staff uses
// requireAccountRole() instead. Defense in depth alongside middleware.ts:
// server actions can be invoked directly, so mutations re-check here rather
// than trusting the route.
export async function requireStaffSession() {
  const session = await auth();
  if (!session?.user || !session.user.isPlatformAdmin) {
    throw new Error("Forbidden: platform admin access required.");
  }
  return session;
}
