import { prisma, SequenceEnrollmentStatus } from "@platform/db";
import { enqueueSequenceStepJob } from "../queues/sequences";

// Idempotent — safe to call more than once for the same contact/sequence
// (e.g. a repeat funnel opt-in): returns the existing enrollment instead of
// creating a duplicate or re-sending step 1.
export async function enrollContactInSequence(sequenceId: string, contactId: string) {
  const existing = await prisma.sequenceEnrollment.findUnique({
    where: { sequenceId_contactId: { sequenceId, contactId } },
  });
  if (existing) return existing;

  const firstStep = await prisma.sequenceStep.findFirst({
    where: { sequenceId },
    orderBy: { order: "asc" },
  });
  if (!firstStep) return null; // sequence has no steps configured yet

  const enrollment = await prisma.sequenceEnrollment.create({
    data: { sequenceId, contactId, status: SequenceEnrollmentStatus.ACTIVE, currentStepOrder: firstStep.order },
  });

  await enqueueSequenceStepJob({ enrollmentId: enrollment.id, stepOrder: firstStep.order }, firstStep.delayMinutes);

  return enrollment;
}
