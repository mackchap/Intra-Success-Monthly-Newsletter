"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSequence, createSequenceStep, setSequenceActive } from "@/lib/sequences";
import { requireStaffSession } from "@/lib/require-staff";
import { str } from "@/lib/form-data";

export async function createSequenceAction(formData: FormData) {
  await requireStaffSession();

  const name = str(formData, "name");
  const trigger = str(formData, "trigger");
  if (!name || !trigger) throw new Error("Name and trigger are required.");

  const sequence = await createSequence({
    name,
    trigger: trigger as never,
    funnelId: str(formData, "funnelId"),
  });

  revalidatePath("/admin/sequences");
  redirect(`/admin/sequences/${sequence.id}`);
}

export async function toggleSequenceActiveAction(formData: FormData) {
  await requireStaffSession();

  const sequenceId = str(formData, "sequenceId");
  const active = str(formData, "active") === "true";
  if (!sequenceId) throw new Error("sequenceId is required.");

  await setSequenceActive(sequenceId, !active);
  revalidatePath(`/admin/sequences/${sequenceId}`);
  revalidatePath("/admin/sequences");
}

export async function createSequenceStepAction(formData: FormData) {
  await requireStaffSession();

  const sequenceId = str(formData, "sequenceId");
  const channel = str(formData, "channel");
  const delayMinutesRaw = str(formData, "delayMinutes");
  const body = str(formData, "body");
  if (!sequenceId || !channel || !body) throw new Error("channel and body are required.");

  await createSequenceStep({
    sequenceId,
    channel: channel as never,
    delayMinutes: delayMinutesRaw ? Number.parseInt(delayMinutesRaw, 10) : 0,
    subject: str(formData, "subject"),
    body,
  });

  revalidatePath(`/admin/sequences/${sequenceId}`);
}
