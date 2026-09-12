import { prisma, ActivityType } from "@platform/db";
import { ValidationError } from "@/lib/crm/errors";

export interface CaptureLeadInput {
  funnelId: string;
  funnelStepId: string;
  data: Record<string, string>;
}

// Turns a funnel lead-capture form submission into CRM records: upserts the
// Contact (repeat opt-ins on the same email update it, not duplicate it),
// logs the raw submission, and ensures exactly one Deal per contact per
// funnel — re-submitting the same funnel's form doesn't create a second
// deal. Mirrors the CRM service-layer pattern (Phase 2): the mutation and
// its Activity log live in the same function.
export async function captureLead(input: CaptureLeadInput) {
  const email = input.data.email;
  if (!email) {
    throw new ValidationError("A lead capture form must collect an email address.");
  }

  const contact = await prisma.contact.upsert({
    where: { email },
    update: {
      firstName: input.data.firstName || undefined,
      lastName: input.data.lastName || undefined,
      phone: input.data.phone || undefined,
    },
    create: {
      email,
      firstName: input.data.firstName || undefined,
      lastName: input.data.lastName || undefined,
      phone: input.data.phone || undefined,
      source: `funnel:${input.funnelId}`,
    },
  });

  await prisma.funnelSubmission.create({
    data: {
      funnelId: input.funnelId,
      funnelStepId: input.funnelStepId,
      contactId: contact.id,
      data: input.data,
    },
  });

  let deal = await prisma.deal.findFirst({ where: { contactId: contact.id, funnelId: input.funnelId } });
  if (!deal) {
    const pipeline = await prisma.pipeline.findFirstOrThrow({
      where: { isDefault: true },
      include: { stages: { orderBy: { order: "asc" }, take: 1 } },
    });
    const funnel = await prisma.funnel.findUniqueOrThrow({ where: { id: input.funnelId } });

    deal = await prisma.deal.create({
      data: {
        title: `${funnel.name} — ${contact.email}`,
        contactId: contact.id,
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0].id,
        funnelId: input.funnelId,
      },
    });
  }

  await prisma.activity.create({
    data: {
      type: ActivityType.FUNNEL_SUBMISSION,
      contactId: contact.id,
      dealId: deal.id,
      metadata: { funnelId: input.funnelId, funnelStepId: input.funnelStepId },
    },
  });

  return { contact, deal };
}
