import { auth } from "@/auth";

// Defense in depth alongside middleware.ts: server actions can be invoked
// directly, so mutations re-check the role rather than trusting the route.
export async function requireStaffSession() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "ADMIN" && role !== "STAFF")) {
    throw new Error("Forbidden: staff or admin access required.");
  }
  return session;
}
