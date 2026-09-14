"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@platform/db";
import { createDeal, moveDealStage } from "@/lib/crm/deals";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { str } from "@/lib/form-data";

export async function createDealAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { session } = await requireAccountRole(tenantId, "STAFF");

  const title = formData.get("title");
  const contactId = formData.get("contactId");
  const stageId = formData.get("stageId");
  if (typeof title !== "string" || !title) throw new Error("Deal title is required.");
  if (typeof contactId !== "string" || !contactId) throw new Error("A contact is required.");
  if (typeof stageId !== "string" || !stageId) throw new Error("A stage is required.");

  // Scoped by tenantId — a stage/contact id belonging to another tenant must
  // fail here rather than let a deal get created against foreign CRM data.
  const stage = await prisma.pipelineStage.findFirstOrThrow({
    where: { id: stageId, pipeline: { tenantId } },
  });
  const contact = await prisma.contact.findFirstOrThrow({ where: { id: contactId, tenantId } });

  const valueDollarsRaw = formData.get("valueDollars");
  const valueCents =
    typeof valueDollarsRaw === "string" && valueDollarsRaw
      ? Math.round(Number.parseFloat(valueDollarsRaw) * 100)
      : 0;

  const deal = await createDeal({
    tenantId,
    title,
    contactId,
    companyId: contact.companyId ?? undefined,
    ownerId: session.user.id,
    pipelineId: stage.pipelineId,
    stageId,
    valueCents,
    actorId: session.user.id,
  });

  revalidatePath(`/a/${tenantId}/staff/deals`);
  redirect(`/a/${tenantId}/staff/deals/${deal.id}`);
}

export async function moveDealStageAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  const { session } = await requireAccountRole(tenantId, "STAFF");

  const dealId = formData.get("dealId");
  const stageId = formData.get("stageId");
  if (typeof dealId !== "string" || !dealId) throw new Error("dealId is required.");
  if (typeof stageId !== "string" || !stageId) throw new Error("stageId is required.");

  await prisma.deal.findFirstOrThrow({ where: { id: dealId, tenantId } });
  await prisma.pipelineStage.findFirstOrThrow({ where: { id: stageId, pipeline: { tenantId } } });

  await moveDealStage(dealId, stageId, session.user.id);

  revalidatePath(`/a/${tenantId}/staff/deals`);
  revalidatePath(`/a/${tenantId}/staff/deals/${dealId}`);
}
