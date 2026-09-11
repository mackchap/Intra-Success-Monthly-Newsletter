import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the Auth.js config: no Prisma adapter, no bcrypt.
// Next.js Middleware runs on the Edge runtime, which can't load Node-only
// dependencies — so `middleware.ts` builds its own NextAuth instance from
// just this config, while `auth.ts` (used by route handlers and server
// components, which run on the Node runtime) extends it with the real
// Credentials provider and Prisma adapter.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
