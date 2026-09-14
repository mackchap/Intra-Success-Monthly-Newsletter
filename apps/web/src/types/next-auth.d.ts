import type { DefaultSession } from "next-auth";

// Phase 8: there is no more global `role` — access to any given Tenant is
// checked fresh from the DB per-request via requireAccountRole() (Node
// runtime only; middleware can't reach Prisma on the Edge runtime). The
// session only carries the one thing cheap enough to gate routes with at
// the edge: whether this user is a platform-level admin (your team, not any
// tenant's own staff) — same "set once at sign-in, requires re-login to
// change" limitation the old global `role` already had.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isPlatformAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isPlatformAdmin: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    isPlatformAdmin: boolean;
  }
}
