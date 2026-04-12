// TranscriptAPI.com — YouTube Skills client
// Provides: transcripts, search, channels, playlists
// Docs: https://transcriptapi.com/openapi.json

const BASE = "https://transcriptapi.com/api/v2/youtube";

function getKey(): string {
  const key = Deno.env.get("TRANSCRIPT_API_KEY");
  if (!key) throw new Error("TRANSCRIPT_API_KEY not configured");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getKey()}`,
  };
}

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TranscriptAPI ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Transcript (1 credit) ─────────────────────────────────────────
export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptResult {
  video_id: string;
  language: string;
  transcript: string | TranscriptSegment[];
  metadata?: {
    title: string;
    author_name: string;
    author_url: string;
    thumbnail_url?: string;
  };
}

export function getTranscript(
  videoUrl: string,
  opts?: { format?: "json" | "text"; timestamps?: boolean; metadata?: boolean }
): Promise<TranscriptResult> {
  const format = opts?.format ?? "text";
  const ts = opts?.timestamps ?? true;
  const meta = opts?.metadata ?? true;
  const url = `${BASE}/transcript?video_url=${encodeURIComponent(videoUrl)}&format=${format}&include_timestamp=${ts}&send_metadata=${meta}`;
  return request<TranscriptResult>(url);
}

// ─── Search (1 credit) ─────────────────────────────────────────────
export interface SearchVideoResult {
  type: "video";
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  lengthText?: string;
  viewCountText?: string;
  publishedTimeText?: string;
  hasCaptions?: boolean;
  thumbnails?: { url: string; width: number; height: number }[];
}

export interface SearchChannelResult {
  type: "channel";
  channelId: string;
  title: string;
  handle?: string;
  subscriberCount?: string;
  verified?: boolean;
}

export function searchYouTube(
  query: string,
  opts?: { type?: "video" | "channel"; limit?: number }
): Promise<{ results: (SearchVideoResult | SearchChannelResult)[]; result_count: number }> {
  const type = opts?.type ?? "video";
  const limit = opts?.limit ?? 20;
  const url = `${BASE}/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`;
  return request(url);
}

// ─── Channel ────────────────────────────────────────────────────────
// Resolve handle → channel ID (FREE)
export function resolveChannel(input: string): Promise<{ channel_id: string; resolved_from: string }> {
  return request(`${BASE}/channel/resolve?input=${encodeURIComponent(input)}`);
}

// Latest 15 videos (FREE)
export function channelLatest(channel: string): Promise<{ results: any[] }> {
  return request(`${BASE}/channel/latest?channel=${encodeURIComponent(channel)}`);
}

// All videos (1 credit/page)
export function channelVideos(
  channelOrContinuation: string,
  isContinuation = false
): Promise<{ results: any[]; continuation_token?: string; has_more?: boolean }> {
  const param = isContinuation ? `continuation=${encodeURIComponent(channelOrContinuation)}` : `channel=${encodeURIComponent(channelOrContinuation)}`;
  return request(`${BASE}/channel/videos?${param}`);
}

// Search within channel (1 credit)
export function channelSearch(
  channel: string,
  query: string,
  limit = 30
): Promise<{ results: any[] }> {
  return request(`${BASE}/channel/search?channel=${encodeURIComponent(channel)}&q=${encodeURIComponent(query)}&limit=${limit}`);
}

// ─── Playlist (1 credit/page) ───────────────────────────────────────
export function playlistVideos(
  playlistOrContinuation: string,
  isContinuation = false
): Promise<{ results: any[]; playlist_info?: any; continuation_token?: string; has_more?: boolean }> {
  const param = isContinuation ? `continuation=${encodeURIComponent(playlistOrContinuation)}` : `playlist=${encodeURIComponent(playlistOrContinuation)}`;
  return request(`${BASE}/playlist/videos?${param}`);
}
