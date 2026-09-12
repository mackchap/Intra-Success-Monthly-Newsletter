"use server";

import { revalidatePath } from "next/cache";
import { prisma, MessageChannel } from "@platform/db";
import { requireStaffSession } from "@/lib/require-staff";
import { draftFollowUpEmail, type DraftedEmail } from "@/lib/agents/follow-up";
import { enqueueManualMessage } from "@/lib/queues/manual-message";

// Called directly from a Client Component event handler (not a <form
// action=...>) since it returns the draft for interactive review/editing
// rather than redirecting — Server Actions support both invocation styles.
export async function draftFollowUpEmailAction(contactId: string): Promise<DraftedEmail> {
  await requireStaffSession();
  return draftFollowUpEmail(contactId);
}

// Unlike the other agents' best-effort enqueue calls (side effects of some
// other primary action, wrapped in .catch), queuing the send IS the
// requested action here, so a failure should surface to the caller.
export async function sendFollowUpEmailAction(contactId: string, subject: string, body: string): Promise<void> {
  await requireStaffSession();

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  if (!contact.email) {
    throw new Error("This contact has no email address on file.");
  }

  await enqueueManualMessage({ contactId, channel: MessageChannel.EMAIL, to: contact.email, subject, body });
  revalidatePath(`/staff/contacts/${contactId}`);
}
