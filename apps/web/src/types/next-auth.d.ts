import type { Role } from "@platform/db";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
  }
}
