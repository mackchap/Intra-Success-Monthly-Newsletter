import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      funnelStep: { findUniqueOrThrow: vi.fn(), update: vi.fn(), count: vi.fn(), create: vi.fn() },
    },
  };
});

import { prisma } from "@platform/db";
import { addBlock, createFunnelStep, moveBlock, removeBlock } from "./steps";
import type { FunnelBlock } from "./blocks";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createFunnelStep", () => {
  it("auto-assigns the next order value", async () => {
    vi.mocked(prisma.funnelStep.count).mockResolvedValue(2);
    vi.mocked(prisma.funnelStep.create).mockResolvedValue({ id: "step_3" } as never);

    await createFunnelStep({ funnelId: "funnel_1", type: "LANDING", name: "Landing", slug: "landing" });

    expect(prisma.funnelStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ order: 2, content: [] }),
    });
  });
});

describe("addBlock", () => {
  it("appends a block to the existing content array", async () => {
    vi.mocked(prisma.funnelStep.findUniqueOrThrow).mockResolvedValue({
      id: "step_1",
      content: [{ type: "heading", text: "Hello" }],
    } as never);

    const newBlock: FunnelBlock = { type: "text", body: "World" };
    await addBlock("step_1", newBlock);

    expect(prisma.funnelStep.update).toHaveBeenCalledWith({
      where: { id: "step_1" },
      data: { content: [{ type: "heading", text: "Hello" }, newBlock] },
    });
  });
});

describe("removeBlock", () => {
  it("removes the block at the given index", async () => {
    vi.mocked(prisma.funnelStep.findUniqueOrThrow).mockResolvedValue({
      id: "step_1",
      content: [{ type: "heading", text: "A" }, { type: "heading", text: "B" }],
    } as never);

    await removeBlock("step_1", 0);

    expect(prisma.funnelStep.update).toHaveBeenCalledWith({
      where: { id: "step_1" },
      data: { content: [{ type: "heading", text: "B" }] },
    });
  });
});

describe("moveBlock", () => {
  it("swaps a block with its previous sibling when moving up", async () => {
    vi.mocked(prisma.funnelStep.findUniqueOrThrow).mockResolvedValue({
      id: "step_1",
      content: [{ type: "heading", text: "A" }, { type: "heading", text: "B" }],
    } as never);

    await moveBlock("step_1", 1, "up");

    expect(prisma.funnelStep.update).toHaveBeenCalledWith({
      where: { id: "step_1" },
      data: { content: [{ type: "heading", text: "B" }, { type: "heading", text: "A" }] },
    });
  });

  it("does nothing when moving the first block up", async () => {
    const step = { id: "step_1", content: [{ type: "heading", text: "A" }] };
    vi.mocked(prisma.funnelStep.findUniqueOrThrow).mockResolvedValue(step as never);

    const result = await moveBlock("step_1", 0, "up");

    expect(prisma.funnelStep.update).not.toHaveBeenCalled();
    expect(result).toBe(step);
  });
});
