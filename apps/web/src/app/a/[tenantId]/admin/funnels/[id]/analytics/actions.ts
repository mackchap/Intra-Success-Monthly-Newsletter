"use server";

import { prisma } from "@platform/db";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { getFunnelOptimizationAdvice } from "@/lib/agents/funnel-optimizer";

export async function getFunnelOptimizationAdviceAction(tenantId: string, funnelId: string): Promise<string> {
  await requireAccountRole(tenantId, "ADMIN");
  await prisma.funnel.findFirstOrThrow({ where: { id: funnelId, tenantId } });
  return getFunnelOptimizationAdvice(funnelId);
}
