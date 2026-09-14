"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@platform/db";
import { createSequence, createSequenceStep, setSequenceActive } from "@/lib/sequences";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { str } from "@/lib/form-data";

async function requireSequenceInTenant(sequenceId: string, tenantId: string) {
  return prisma.sequence.findFirstOrThrow({ where: { id: sequenceId, tenantId } });
}

export async function createSequenceAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const name = str(formData, "name");
  const trigger = str(formData, "trigger");
  if (!name || !trigger) throw new Error("Name and trigger are required.");

  const funnelId = str(formData, "funnelId");
  if (funnelId) {
    await prisma.funnel.findFirstOrThrow({ where: { id: funnelId, tenantId } });
  }

  const sequence = await createSequence({ tenantId, name, trigger: trigger as never, funnelId });

  revalidatePath(`/a/${tenantId}/admin/sequences`);
  redirect(`/a/${tenantId}/admin/sequences/${sequence.id}`);
}

export async function toggleSequenceActiveAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const sequenceId = str(formData, "sequenceId");
  const active = str(formData, "active") === "true";
  if (!sequenceId) throw new Error("sequenceId is required.");
  await requireSequenceInTenant(sequenceId, tenantId);

  await setSequenceActive(sequenceId, !active);
  revalidatePath(`/a/${tenantId}/admin/sequences/${sequenceId}`);
  revalidatePath(`/a/${tenantId}/admin/sequences`);
}

export async function createSequenceStepAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const sequenceId = str(formData, "sequenceId");
  const channel = str(formData, "channel");
  const delayMinutesRaw = str(formData, "delayMinutes");
  const body = str(formData, "body");
  if (!sequenceId || !channel || !body) throw new Error("channel and body are required.");
  await requireSequenceInTenant(sequenceId, tenantId);

  await createSequenceStep({
    sequenceId,
    channel: channel as never,
    delayMinutes: delayMinutesRaw ? Number.parseInt(delayMinutesRaw, 10) : 0,
    subject: str(formData, "subject"),
    body,
  });

  revalidatePath(`/a/${tenantId}/admin/sequences/${sequenceId}`);
}
