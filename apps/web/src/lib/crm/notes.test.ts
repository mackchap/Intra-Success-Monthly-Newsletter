import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      note: { create: vi.fn() },
      activity: { create: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import { createNote } from "./notes";
import { ValidationError } from "./errors";

describe("createNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a note with no contact or deal attached", async () => {
    await expect(createNote({ tenantId: "tenant-1", body: "hi", authorId: "user-1" })).rejects.toThrow(
      ValidationError,
    );
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("creates a note attached to a contact and logs a NOTE_ADDED activity", async () => {
    vi.mocked(prisma.note.create).mockResolvedValue({ id: "note-1" } as never);

    await createNote({
      tenantId: "tenant-1",
      body: "Called, left voicemail",
      authorId: "user-1",
      contactId: "contact-1",
    });

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        body: "Called, left voicemail",
        authorId: "user-1",
        contactId: "contact-1",
        dealId: undefined,
      },
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "NOTE_ADDED", contactId: "contact-1", metadata: { noteId: "note-1" } }),
    });
  });

  it("creates a note attached to a deal only", async () => {
    vi.mocked(prisma.note.create).mockResolvedValue({ id: "note-2" } as never);

    await createNote({ tenantId: "tenant-1", body: "Sent proposal", authorId: "user-1", dealId: "deal-1" });

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "NOTE_ADDED", dealId: "deal-1" }),
    });
  });
});
