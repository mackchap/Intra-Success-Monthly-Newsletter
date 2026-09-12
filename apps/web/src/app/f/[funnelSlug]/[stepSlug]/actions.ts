"use server";

import { redirect } from "next/navigation";
import { prisma } from "@platform/db";
import { captureLead } from "@/lib/funnels/leads";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { auth } from "@/auth";
import { str } from "@/lib/form-data";

const LEAD_FIELD_KEYS = ["email", "firstName", "lastName", "phone"] as const;

export async function leadCaptureAction(formData: FormData) {
  const funnelId = str(formData, "funnelId");
  const funnelStepId = str(formData, "funnelStepId");
  const funnelSlug = str(formData, "funnelSlug");
  const stepSlug = str(formData, "stepSlug");
  if (!funnelId || !funnelStepId || !funnelSlug || !stepSlug) {
    throw new Error("Missing funnel context.");
  }

  const data: Record<string, string> = {};
  for (const key of LEAD_FIELD_KEYS) {
    const value = str(formData, key);
    if (value) data[key] = value;
  }

  const { contact } = await captureLead({ funnelId, funnelStepId, data });

  const steps = await prisma.funnelStep.findMany({ where: { funnelId }, orderBy: { order: "asc" } });
  const currentIndex = steps.findIndex((s) => s.id === funnelStepId);
  const nextStep = steps[currentIndex + 1];

  if (nextStep) {
    redirect(`/f/${funnelSlug}/${nextStep.slug}?lead=${contact.id}`);
  }
  redirect(`/f/${funnelSlug}/${stepSlug}?lead=${contact.id}&submitted=1`);
}

export async function funnelBuyAction(formData: FormData) {
  const productId = str(formData, "productId");
  const funnelId = str(formData, "funnelId");
  const lead = str(formData, "lead");
  if (!productId) throw new Error("productId is required.");

  const session = await auth();
  if (!session?.user) {
    const params = new URLSearchParams({ productId });
    if (funnelId) params.set("funnelId", funnelId);
    if (lead) params.set("lead", lead);
    redirect(`/signup?${params.toString()}`);
  }

  const deal =
    lead && funnelId ? await prisma.deal.findFirst({ where: { contactId: lead, funnelId } }) : null;

  const url = await createCheckoutSession({ productId, userId: session.user.id, dealId: deal?.id });
  redirect(url);
}
