import type { VideoProvider } from "@platform/db";

// No self-hosted video (per CLAUDE.md) — both providers support plain
// iframe embeds keyed by an opaque id, no API key needed just to play back.
export function videoEmbedUrl(provider: VideoProvider | null | undefined, videoId: string | null | undefined) {
  if (!provider || !videoId) return null;
  if (provider === "MUX") return `https://player.mux.com/${videoId}`;
  if (provider === "VIMEO") return `https://player.vimeo.com/video/${videoId}`;
  return null;
}
