import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("You must be signed in.");
  }
  return session;
}
