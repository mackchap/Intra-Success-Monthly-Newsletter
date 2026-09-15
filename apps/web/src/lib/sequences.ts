import { prisma, MessageChannel, SequenceTrigger } from "@platform/db";

export interface CreateSequenceInput {
  tenantId: string;
  name: string;
  trigger: SequenceTrigger;
  funnelId?: string;
}

export async function createSequence(input: CreateSequenceInput) {
  return prisma.sequence.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      trigger: input.trigger,
      funnelId: input.funnelId,
    },
  });
}

export async function setSequenceActive(sequenceId: string, active: boolean) {
  return prisma.sequence.update({ where: { id: sequenceId }, data: { active } });
}

// Order auto-assigned (append to the end), same rationale as everywhere
// else in the app an ordered list is admin-authored (modules, lessons,
// funnel steps).
export async function createSequenceStep(input: {
  sequenceId: string;
  channel: MessageChannel;
  delayMinutes: number;
  subject?: string;
  body: string;
}) {
  const count = await prisma.sequenceStep.count({ where: { sequenceId: input.sequenceId } });
  return prisma.sequenceStep.create({
    data: {
      sequenceId: input.sequenceId,
      order: count,
      channel: input.channel,
      delayMinutes: input.delayMinutes,
      subject: input.subject,
      body: input.body,
    },
  });
}
