"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@platform/db";
import { createFunnel, setFunnelStatus, createFunnelStep, addBlock, removeBlock, moveBlock } from "@/lib/funnels/steps";
import type { FunnelBlock, LeadFormField } from "@/lib/funnels/blocks";
import { requireAccountRole } from "@/lib/accounts/require-account";
import { str } from "@/lib/form-data";

// Every action below is scoped by tenantId (a hidden form field, since these
// forms don't carry the route's [tenantId] param automatically) and
// re-verifies the target funnel/step actually belongs to that tenant before
// mutating it — defense in depth against a forged tenantId.

export async function createFunnelAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const name = str(formData, "name");
  const slug = str(formData, "slug");
  if (!name || !slug) throw new Error("Name and slug are required.");

  const funnel = await createFunnel({ tenantId, name, slug, description: str(formData, "description") });

  revalidatePath(`/a/${tenantId}/admin/funnels`);
  redirect(`/a/${tenantId}/admin/funnels/${funnel.id}`);
}

async function requireFunnelInTenant(funnelId: string, tenantId: string) {
  return prisma.funnel.findFirstOrThrow({ where: { id: funnelId, tenantId } });
}

export async function publishFunnelAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const funnelId = str(formData, "funnelId");
  const currentStatus = str(formData, "status");
  if (!funnelId) throw new Error("funnelId is required.");
  await requireFunnelInTenant(funnelId, tenantId);

  await setFunnelStatus(funnelId, currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED");
  revalidatePath(`/a/${tenantId}/admin/funnels/${funnelId}`);
  revalidatePath(`/a/${tenantId}/admin/funnels`);
}

export async function createStepAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const funnelId = str(formData, "funnelId");
  const type = str(formData, "type");
  const name = str(formData, "name");
  const slug = str(formData, "slug");
  if (!funnelId || !type || !name || !slug) throw new Error("type, name, and slug are required.");
  await requireFunnelInTenant(funnelId, tenantId);

  await createFunnelStep({ funnelId, type: type as never, name, slug });
  revalidatePath(`/a/${tenantId}/admin/funnels/${funnelId}`);
}

export async function addBlockAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const funnelId = str(formData, "funnelId");
  const stepId = str(formData, "stepId");
  const type = str(formData, "type");
  if (!funnelId || !stepId || !type) throw new Error("type is required.");
  await requireFunnelInTenant(funnelId, tenantId);

  let block: FunnelBlock;
  switch (type) {
    case "heading":
      block = { type: "heading", text: str(formData, "text") ?? "" };
      break;
    case "text":
      block = { type: "text", body: str(formData, "body") ?? "" };
      break;
    case "image":
      block = { type: "image", url: str(formData, "url") ?? "", alt: str(formData, "alt") };
      break;
    case "button":
      block = { type: "button", label: str(formData, "label") ?? "Continue", href: str(formData, "href") ?? "#" };
      break;
    case "form":
      block = {
        type: "form",
        fields: formData.getAll("fields") as LeadFormField[],
        submitLabel: str(formData, "submitLabel") ?? "Submit",
      };
      break;
    case "buy":
      block = {
        type: "buy",
        productId: str(formData, "productId") ?? "",
        label: str(formData, "label") ?? "Buy now",
      };
      break;
    default:
      throw new Error(`Unknown block type: ${type}`);
  }

  await addBlock(stepId, block);
  revalidatePath(`/a/${tenantId}/admin/funnels/${funnelId}`);
}

export async function removeBlockAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const funnelId = str(formData, "funnelId");
  const stepId = str(formData, "stepId");
  const index = str(formData, "index");
  if (!funnelId || !stepId || index === undefined) throw new Error("stepId and index are required.");
  await requireFunnelInTenant(funnelId, tenantId);

  await removeBlock(stepId, Number.parseInt(index, 10));
  revalidatePath(`/a/${tenantId}/admin/funnels/${funnelId}`);
}

export async function moveBlockAction(formData: FormData) {
  const tenantId = str(formData, "tenantId");
  if (!tenantId) throw new Error("tenantId is required.");
  await requireAccountRole(tenantId, "ADMIN");

  const funnelId = str(formData, "funnelId");
  const stepId = str(formData, "stepId");
  const index = str(formData, "index");
  const direction = str(formData, "direction");
  if (!funnelId || !stepId || index === undefined || (direction !== "up" && direction !== "down")) {
    throw new Error("stepId, index, and a valid direction are required.");
  }
  await requireFunnelInTenant(funnelId, tenantId);

  await moveBlock(stepId, Number.parseInt(index, 10), direction);
  revalidatePath(`/a/${tenantId}/admin/funnels/${funnelId}`);
}
