import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MetaApiError,
  exchangeCodeForUserToken,
  getPostInsights,
  listManagedPages,
  publishFacebookPagePost,
  publishInstagramPost,
} from "./meta";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.META_APP_ID = "app_123";
  process.env.META_APP_SECRET = "secret_456";
});

describe("exchangeCodeForUserToken", () => {
  it("posts the OAuth code and returns the access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: "short_token", expires_in: 5400 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeCodeForUserToken({ code: "abc", redirectUri: "https://example.com/callback" });

    expect(result).toEqual({ accessToken: "short_token", expiresIn: 5400 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/oauth/access_token");
    expect(url).toContain("client_id=app_123");
    expect(url).toContain("code=abc");
  });

  it("throws MetaApiError with Meta's error message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Invalid code" } }, false, 400)));

    await expect(exchangeCodeForUserToken({ code: "bad", redirectUri: "https://example.com" })).rejects.toThrow(
      MetaApiError,
    );
    await expect(exchangeCodeForUserToken({ code: "bad", redirectUri: "https://example.com" })).rejects.toThrow(
      "Invalid code",
    );
  });
});

describe("listManagedPages", () => {
  it("maps Graph API page fields to ManagedPage, including a linked Instagram account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            { id: "page_1", name: "My Page", access_token: "page_token_1", instagram_business_account: { id: "ig_1" } },
            { id: "page_2", name: "No IG Page", access_token: "page_token_2" },
          ],
        }),
      ),
    );

    const pages = await listManagedPages("user_token");

    expect(pages).toEqual([
      { id: "page_1", name: "My Page", accessToken: "page_token_1", instagramBusinessAccountId: "ig_1" },
      { id: "page_2", name: "No IG Page", accessToken: "page_token_2", instagramBusinessAccountId: undefined },
    ]);
  });
});

describe("publishFacebookPagePost", () => {
  it("posts to the page's /feed endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "page_1_post_1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishFacebookPagePost({ pageId: "page_1", accessToken: "tok", message: "Hello!" });

    expect(result).toEqual({ externalPostId: "page_1_post_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/page_1/feed");
    expect(init.method).toBe("POST");
  });
});

describe("publishInstagramPost", () => {
  it("creates a media container then publishes it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "ig_post_1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishInstagramPost({
      igUserId: "ig_1",
      accessToken: "tok",
      caption: "Nice photo",
      imageUrl: "https://example.com/photo.jpg",
    });

    expect(result).toEqual({ externalPostId: "ig_post_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v21.0/ig_1/media");
    expect(fetchMock.mock.calls[1][0]).toBe("https://graph.facebook.com/v21.0/ig_1/media_publish");
  });

  it("does not attempt to publish if creating the container fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Bad image URL" } }, false, 400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishInstagramPost({ igUserId: "ig_1", accessToken: "tok", caption: "x", imageUrl: "bad-url" }),
    ).rejects.toThrow("Bad image URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getPostInsights", () => {
  it("requests the given metrics for a post", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ name: "impressions", values: [{ value: 42 }] }] }));
    vi.stubGlobal("fetch", fetchMock);

    await getPostInsights({ postId: "post_1", accessToken: "tok", metrics: ["impressions", "reach"] });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/post_1/insights");
    expect(url).toContain("metric=impressions%2Creach");
  });
});
