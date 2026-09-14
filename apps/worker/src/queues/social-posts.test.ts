import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  Worker: vi.fn(),
}));

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      socialPost: { findUnique: vi.fn(), update: vi.fn() },
    },
  };
});

vi.mock("../social/crypto", () => ({
  decryptToken: vi.fn(() => "decrypted_access_token"),
}));

vi.mock("../social/meta", () => ({
  publishFacebookPagePost: vi.fn(),
  publishInstagramPost: vi.fn(),
}));

import { prisma } from "@platform/db";
import { publishFacebookPagePost, publishInstagramPost } from "../social/meta";
import { enqueuePublishSocialPost, processSocialPostJob, socialPostQueue } from "./social-posts";

function postFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "post_1",
    platform: "FACEBOOK",
    caption: "Hello world",
    mediaUrl: null,
    status: "APPROVED",
    socialAccount: { externalId: "page_1", accessTokenEncrypted: "enc_token" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enqueuePublishSocialPost", () => {
  it("adds a publish job with the given delay", async () => {
    await enqueuePublishSocialPost("post_1", 60000);
    expect(socialPostQueue.add).toHaveBeenCalledWith("publish", { socialPostId: "post_1" }, { delay: 60000 });
  });
});

describe("processSocialPostJob", () => {
  it("does nothing if the post no longer exists", async () => {
    vi.mocked(prisma.socialPost.findUnique).mockResolvedValue(null);
    await processSocialPostJob({ socialPostId: "missing" });
    expect(publishFacebookPagePost).not.toHaveBeenCalled();
  });

  it("does nothing if the post is no longer APPROVED or SCHEDULED", async () => {
    vi.mocked(prisma.socialPost.findUnique).mockResolvedValue(postFixture({ status: "REJECTED" }) as never);
    await processSocialPostJob({ socialPostId: "post_1" });
    expect(publishFacebookPagePost).not.toHaveBeenCalled();
    expect(prisma.socialPost.update).not.toHaveBeenCalled();
  });

  it("publishes a Facebook post and marks it PUBLISHED", async () => {
    vi.mocked(prisma.socialPost.findUnique).mockResolvedValue(postFixture() as never);
    vi.mocked(publishFacebookPagePost).mockResolvedValue({ externalPostId: "fb_post_123" });

    await processSocialPostJob({ socialPostId: "post_1" });

    expect(publishFacebookPagePost).toHaveBeenCalledWith({
      pageId: "page_1",
      accessToken: "decrypted_access_token",
      message: "Hello world",
    });
    expect(prisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: { status: "PUBLISHING" },
    });
    expect(prisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: expect.objectContaining({ status: "PUBLISHED", externalPostId: "fb_post_123", error: null }),
    });
  });

  it("publishes an Instagram post using the image URL", async () => {
    vi.mocked(prisma.socialPost.findUnique).mockResolvedValue(
      postFixture({ platform: "INSTAGRAM", mediaUrl: "https://example.com/img.jpg" }) as never,
    );
    vi.mocked(publishInstagramPost).mockResolvedValue({ externalPostId: "ig_post_1" });

    await processSocialPostJob({ socialPostId: "post_1" });

    expect(publishInstagramPost).toHaveBeenCalledWith({
      igUserId: "page_1",
      accessToken: "decrypted_access_token",
      caption: "Hello world",
      imageUrl: "https://example.com/img.jpg",
    });
  });

  it("marks the post FAILED with the error message if publishing throws", async () => {
    vi.mocked(prisma.socialPost.findUnique).mockResolvedValue(postFixture() as never);
    vi.mocked(publishFacebookPagePost).mockRejectedValue(new Error("Invalid access token"));

    await processSocialPostJob({ socialPostId: "post_1" });

    expect(prisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: { status: "FAILED", error: "Invalid access token" },
    });
  });
});
