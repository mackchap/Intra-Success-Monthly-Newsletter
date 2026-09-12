"use server";

import { requireStaffSession } from "@/lib/require-staff";
import { getFunnelOptimizationAdvice } from "@/lib/agents/funnel-optimizer";

export async function getFunnelOptimizationAdviceAction(funnelId: string): Promise<string> {
  await requireStaffSession();
  return getFunnelOptimizationAdvice(funnelId);
}
