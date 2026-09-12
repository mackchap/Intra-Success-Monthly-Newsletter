import { prisma, ActivityType } from "@platform/db";
import { ValidationError } from "./errors";

export interface CreateNoteInput {
  body: string;
  authorId: string;
  contactId?: string;
  dealId?: string;
}

// A note always has to be about something — enforce at least one attachment
// rather than letting orphaned notes pile up with no way to find them again.
export async function createNote(input: CreateNoteInput) {
  if (!input.contactId && !input.dealId) {
    throw new ValidationError("A note must be attached to a contact or a deal.");
  }

  const note = await prisma.note.create({
    data: {
      body: input.body,
      authorId: input.authorId,
      contactId: input.contactId,
      dealId: input.dealId,
    },
  });

  await prisma.activity.create({
    data: {
      type: ActivityType.NOTE_ADDED,
      actorId: input.authorId,
      contactId: input.contactId,
      dealId: input.dealId,
      metadata: { noteId: note.id },
    },
  });

  return note;
}
