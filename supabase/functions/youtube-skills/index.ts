const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import {
  getTranscript,
  searchYouTube,
  resolveChannel,
  channelLatest,
  channelVideos,
  channelSearch,
  playlistVideos,
} from "../_shared/transcript-api.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    let result: unknown;

    switch (action) {
      // ── Transcript ──────────────────────────────────────────────
      case "transcript":
        if (!params.video_url) throw new Error("video_url required");
        result = await getTranscript(params.video_url, {
          format: params.format,
          timestamps: params.timestamps,
          metadata: params.metadata,
        });
        break;

      // ── Search ──────────────────────────────────────────────────
      case "search":
        if (!params.query) throw new Error("query required");
        result = await searchYouTube(params.query, {
          type: params.type,
          limit: params.limit,
        });
        break;

      // ── Channel resolve (FREE) ─────────────────────────────────
      case "channel_resolve":
        if (!params.input) throw new Error("input required");
        result = await resolveChannel(params.input);
        break;

      // ── Channel latest (FREE) ──────────────────────────────────
      case "channel_latest":
        if (!params.channel) throw new Error("channel required");
        result = await channelLatest(params.channel);
        break;

      // ── Channel videos (1 credit/page) ─────────────────────────
      case "channel_videos":
        if (!params.channel && !params.continuation) throw new Error("channel or continuation required");
        result = await channelVideos(
          params.continuation || params.channel,
          !!params.continuation
        );
        break;

      // ── Channel search (1 credit) ──────────────────────────────
      case "channel_search":
        if (!params.channel || !params.query) throw new Error("channel and query required");
        result = await channelSearch(params.channel, params.query, params.limit);
        break;

      // ── Playlist (1 credit/page) ───────────────────────────────
      case "playlist_videos":
        if (!params.playlist && !params.continuation) throw new Error("playlist or continuation required");
        result = await playlistVideos(
          params.continuation || params.playlist,
          !!params.continuation
        );
        break;

      default:
        throw new Error(`Unknown action: ${action}. Valid: transcript, search, channel_resolve, channel_latest, channel_videos, channel_search, playlist_videos`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = msg.includes("402") ? 402 : msg.includes("401") ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
