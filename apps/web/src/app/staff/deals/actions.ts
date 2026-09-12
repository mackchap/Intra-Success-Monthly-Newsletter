"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@platform/db";
import { createDeal, moveDealStage } from "@/lib/crm/deals";
import { requireStaffSession } from "@/lib/require-staff";

export async function createDealAction(formData: FormData) {
  const session = await requireStaffSession();

  const title = formData.get("title");
  const contactId = formData.get("contactId");
  const stageId = formData.get("stageId");
  if (typeof title !== "string" || !title) throw new Error("Deal title is required.");
  if (typeof contactId !== "string" || !contactId) throw new Error("A contact is required.");
  if (typeof stageId !== "string" || !stageId) throw new Error("A stage is required.");

  const stage = await prisma.pipelineStage.findUniqueOrThrow({ where: { id: stageId } });
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });

  const valueDollarsRaw = formData.get("valueDollars");
  const valueCents =
    typeof valueDollarsRaw === "string" && valueDollarsRaw
      ? Math.round(Number.parseFloat(valueDollarsRaw) * 100)
      : 0;

  const deal = await createDeal({
    title,
    contactId,
    companyId: contact.companyId ?? undefined,
    ownerId: session.user.id,
    pipelineId: stage.pipelineId,
    stageId,
    valueCents,
    actorId: session.user.id,
  });

  revalidatePath("/staff/deals");
  redirect(`/staff/deals/${deal.id}`);
}

export async function moveDealStageAction(formData: FormData) {
  const session = await requireStaffSession();

  const dealId = formData.get("dealId");
  const stageId = formData.get("stageId");
  if (typeof dealId !== "string" || !dealId) throw new Error("dealId is required.");
  if (typeof stageId !== "string" || !stageId) throw new Error("stageId is required.");

  await moveDealStage(dealId, stageId, session.user.id);

  revalidatePath("/staff/deals");
  revalidatePath(`/staff/deals/${dealId}`);
}
