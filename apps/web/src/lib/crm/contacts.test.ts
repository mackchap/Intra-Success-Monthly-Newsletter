import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      contact: { create: vi.fn() },
    },
  };
});

vi.mock("@/lib/queues/lead-qualification", () => ({
  enqueueLeadQualification: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@platform/db";
import { enqueueLeadQualification } from "@/lib/queues/lead-qualification";
import { createContact } from "./contacts";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createContact", () => {
  it("creates the contact and enqueues background lead qualification", async () => {
    vi.mocked(prisma.contact.create).mockResolvedValue({ id: "contact_1", email: "new@example.com" } as never);

    const contact = await createContact({ email: "new@example.com" });

    expect(contact).toEqual({ id: "contact_1", email: "new@example.com" });
    expect(enqueueLeadQualification).toHaveBeenCalledWith("contact_1");
  });

  it("still returns the created contact if the queue enqueue fails", async () => {
    vi.mocked(prisma.contact.create).mockResolvedValue({ id: "contact_1", email: "new@example.com" } as never);
    vi.mocked(enqueueLeadQualification).mockRejectedValue(new Error("Redis is down"));

    const contact = await createContact({ email: "new@example.com" });

    expect(contact).toEqual({ id: "contact_1", email: "new@example.com" });
  });
});
