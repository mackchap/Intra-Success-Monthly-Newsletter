import { prisma, FunnelStepType } from "@platform/db";
import { parseBlocks, type FunnelBlock } from "./blocks";

export interface CreateFunnelInput {
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
}

export async function createFunnel(input: CreateFunnelInput) {
  return prisma.funnel.create({ data: input });
}

export async function setFunnelStatus(funnelId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  return prisma.funnel.update({ where: { id: funnelId }, data: { status } });
}

// Order is auto-assigned (append to the end), same rationale as Academy's
// modules/lessons — one less error-prone field for the admin to manage.
export async function createFunnelStep(input: {
  funnelId: string;
  type: FunnelStepType;
  name: string;
  slug: string;
}) {
  const count = await prisma.funnelStep.count({ where: { funnelId: input.funnelId } });
  return prisma.funnelStep.create({
    data: { funnelId: input.funnelId, type: input.type, name: input.name, slug: input.slug, order: count, content: [] },
  });
}

export async function addBlock(stepId: string, block: FunnelBlock) {
  const step = await prisma.funnelStep.findUniqueOrThrow({ where: { id: stepId } });
  const blocks = parseBlocks(step.content);
  blocks.push(block);
  return prisma.funnelStep.update({ where: { id: stepId }, data: { content: blocks as never } });
}

export async function removeBlock(stepId: string, index: number) {
  const step = await prisma.funnelStep.findUniqueOrThrow({ where: { id: stepId } });
  const blocks = parseBlocks(step.content);
  blocks.splice(index, 1);
  return prisma.funnelStep.update({ where: { id: stepId }, data: { content: blocks as never } });
}

export async function moveBlock(stepId: string, index: number, direction: "up" | "down") {
  const step = await prisma.funnelStep.findUniqueOrThrow({ where: { id: stepId } });
  const blocks = parseBlocks(step.content);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= blocks.length) return step;

  [blocks[index], blocks[targetIndex]] = [blocks[targetIndex], blocks[index]];
  return prisma.funnelStep.update({ where: { id: stepId }, data: { content: blocks as never } });
}
