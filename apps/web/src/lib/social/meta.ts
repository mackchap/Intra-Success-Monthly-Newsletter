// Thin wrapper over Meta's Graph API — there is no first-party Meta Node SDK,
// so this is plain fetch, same as any other REST integration without an SDK.
// Every function here talks to a real Meta endpoint; none of it is testable
// end-to-end without a real Meta App + Business account (see CLAUDE.md).

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaApiError";
  }
}

function getAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new MetaApiError("META_APP_ID / META_APP_SECRET are not set.");
  }
  return { appId, appSecret };
}

async function graphRequest<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<T> {
  const query = new URLSearchParams(params);
  const url = method === "GET" ? `${GRAPH_API_BASE}${path}?${query.toString()}` : `${GRAPH_API_BASE}${path}`;
  const response = await fetch(url, method === "POST" ? { method: "POST", body: query } : undefined);
  const data = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new MetaApiError(data?.error?.message ?? `Meta API error (HTTP ${response.status})`);
  }
  return data as T;
}

export async function exchangeCodeForUserToken(input: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret } = getAppCredentials();
  const data = await graphRequest<{ access_token: string; expires_in: number }>("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// A long-lived token lasts ~60 days rather than the ~1-2 hours a fresh user
// token gets — always exchange before storing one.
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret } = getAppCredentials();
  const data = await graphRequest<{ access_token: string; expires_in: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export interface ManagedPage {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccountId?: string;
}

// Pages have their own long-lived, non-expiring-by-default access tokens
// distinct from the user's — this is the token actually stored per SocialAccount.
export async function listManagedPages(userAccessToken: string): Promise<ManagedPage[]> {
  const data = await graphRequest<{
    data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
  }>("/me/accounts", { access_token: userAccessToken, fields: "id,name,access_token,instagram_business_account" });

  return data.data.map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    instagramBusinessAccountId: page.instagram_business_account?.id,
  }));
}

export interface PublishResult {
  externalPostId: string;
}

export async function publishFacebookPagePost(input: {
  pageId: string;
  accessToken: string;
  message: string;
  link?: string;
}): Promise<PublishResult> {
  const params: Record<string, string> = { message: input.message, access_token: input.accessToken };
  if (input.link) params.link = input.link;
  const data = await graphRequest<{ id: string }>(`/${input.pageId}/feed`, params, "POST");
  return { externalPostId: data.id };
}

// Instagram publishing is a two-step flow: create a media container from the
// image, then publish that container — there's no single-call equivalent to
// the Facebook Page /feed endpoint.
export async function publishInstagramPost(input: {
  igUserId: string;
  accessToken: string;
  caption: string;
  imageUrl: string;
}): Promise<PublishResult> {
  const container = await graphRequest<{ id: string }>(
    `/${input.igUserId}/media`,
    { image_url: input.imageUrl, caption: input.caption, access_token: input.accessToken },
    "POST",
  );
  const published = await graphRequest<{ id: string }>(
    `/${input.igUserId}/media_publish`,
    { creation_id: container.id, access_token: input.accessToken },
    "POST",
  );
  return { externalPostId: published.id };
}

export async function getPostInsights(input: {
  postId: string;
  accessToken: string;
  metrics: string[];
}): Promise<Record<string, unknown>> {
  return graphRequest(`/${input.postId}/insights`, { metric: input.metrics.join(","), access_token: input.accessToken });
}
