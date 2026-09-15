"use server";

import { notFound } from "next/navigation";
import { prisma } from "@platform/db";
import { askDirectoryConcierge, type ChatMessage } from "@/lib/agents/directory-concierge";

// directoryId is deliberately derived from tenantSlug server-side, not
// trusted from the client — same defense-in-depth reasoning as the lesson
// chat action: a Server Action is invocable directly, so it re-derives
// everything it needs to scope the search rather than trusting a
// caller-supplied id. No auth required — the directory storefront and its
// concierge are public.
export async function askDirectoryConciergeAction(
  tenantSlug: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) notFound();

  const directory = await prisma.directory.findUnique({ where: { tenantId: tenant.id }, select: { id: true } });
  if (!directory) notFound();

  return askDirectoryConcierge(directory.id, history, userMessage);
}
