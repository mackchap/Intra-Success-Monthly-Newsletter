import { prisma, ActivityType } from "@platform/db";
import { ValidationError } from "@/lib/crm/errors";
import { enqueueFunnelSubmissionTrigger } from "@/lib/queues/sequence-triggers";
import { enqueueLeadQualification } from "@/lib/queues/lead-qualification";

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

  // Funnels are tenant-scoped (Phase 9) — a lead always lands in the same
  // tenant as the funnel it came from, not some fallback.
  const funnel = await prisma.funnel.findUniqueOrThrow({
    where: { id: input.funnelId },
    select: { tenantId: true, name: true },
  });
  const tenantId = funnel.tenantId;

  const existingContact = await prisma.contact.findUnique({ where: { tenantId_email: { tenantId, email } } });
  const contact = await prisma.contact.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {
      firstName: input.data.firstName || undefined,
      lastName: input.data.lastName || undefined,
      phone: input.data.phone || undefined,
    },
    create: {
      tenantId,
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
      where: { tenantId, isDefault: true },
      include: { stages: { orderBy: { order: "asc" }, take: 1 } },
    });
    deal = await prisma.deal.create({
      data: {
        tenantId,
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
      tenantId,
      type: ActivityType.FUNNEL_SUBMISSION,
      contactId: contact.id,
      dealId: deal.id,
      metadata: { funnelId: input.funnelId, funnelStepId: input.funnelStepId },
    },
  });

  // Best-effort: a stalled Redis/worker shouldn't fail lead capture itself,
  // only the welcome/nurture sequence enrollment that depends on it.
  enqueueFunnelSubmissionTrigger(input.funnelId, contact.id).catch((error) =>
    console.warn(`Failed to enqueue funnel-submission trigger for contact ${contact.id}:`, error),
  );

  // Only a genuinely new contact gets AI-qualified — a repeat opt-in on the
  // same email would otherwise re-run (and re-log) qualification every time.
  if (!existingContact) {
    enqueueLeadQualification(contact.id).catch((error) =>
      console.warn(`Failed to enqueue lead qualification for contact ${contact.id}:`, error),
    );
  }

  return { contact, deal };
}
