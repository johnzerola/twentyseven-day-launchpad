import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { runSquadPipeline, SQUAD_PRESETS } from "../_shared/squad-runner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEVEN_DAYS_MS = 7 * 86400000;

interface VideoStat {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  published: string;
  durationISO?: string;
}

async function fetchChannelVideos(channelId: string, ytKey: string, max = 20): Promise<VideoStat[]> {
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=${max}&type=video&key=${ytKey}`;
  const sRes = await fetch(searchUrl);
  if (!sRes.ok) return [];
  const sData = await sRes.json();
  const ids = (sData.items || []).map((i: any) => i.id?.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${ids.join(",")}&key=${ytKey}`;
  const stRes = await fetch(statsUrl);
  if (!stRes.ok) return [];
  const stData = await stRes.json();
  return (stData.items || []).map((v: any) => ({
    videoId: v.id,
    title: v.snippet?.title || "",
    views: parseInt(v.statistics?.viewCount || "0"),
    likes: parseInt(v.statistics?.likeCount || "0"),
    comments: parseInt(v.statistics?.commentCount || "0"),
    published: v.snippet?.publishedAt || "",
    durationISO: v.contentDetails?.duration,
  }));
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Try extract first {...} block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* empty */ }
    }
    return {};
  }
}

async function processChannel(
  sb: any,
  ref: any,
  ytKey: string,
  googleKey: string,
  lovableKey: string,
  forceFull: boolean,
): Promise<{ ok: boolean; mode: string; error?: string }> {
  // 1. Fetch videos from YouTube
  const videos = await fetchChannelVideos(ref.youtube_channel_id, ytKey, 20);
  if (videos.length === 0) return { ok: false, mode: "skip", error: "no videos" };

  // Sort: top performers first, then attach worst
  const sorted = [...videos].sort((a, b) => b.views - a.views);
  const top = sorted.slice(0, 8);
  const worst = sorted.slice(-3);
  const avgViews = videos.reduce((s, v) => s + v.views, 0) / videos.length;

  // 2. Decide pipeline: full (4 agents) on first scan / forced / viral spike. Light (1+4) otherwise.
  const previousIntel = ref.latest_intel || {};
  const hasPriorScan = !!previousIntel.scanned_at;
  const viralSpike = top[0]?.views > avgViews * 3;
  const useFull = forceFull || !hasPriorScan || viralSpike;

  const inputData = {
    channel_name: ref.channel_name,
    role: ref.role,
    avg_views: Math.round(avgViews),
    top_videos: top.map(v => ({
      title: v.title,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      published: v.published,
    })),
    worst_videos: worst.map(v => ({
      title: v.title,
      views: v.views,
      published: v.published,
    })),
    total_videos_scanned: videos.length,
    previous_intel_summary: hasPriorScan ? {
      last_scanned: previousIntel.scanned_at,
      previous_top_titles: (previousIntel.scanner?.top_performers || []).slice(0, 3),
    } : null,
  };

  // 3. Run pipeline
  const pipeline = useFull
    ? SQUAD_PRESETS.reference_intel
    // Light mode: only Scanner + Evolution Tracker
    : {
        name: "Squad Reference Light",
        agents: [
          SQUAD_PRESETS.reference_intel.agents[0],
          SQUAD_PRESETS.reference_intel.agents[3],
        ],
        final_only: false,
      };

  const result = await runSquadPipeline(googleKey, lovableKey, pipeline, inputData);

  // 4. Build structured intel from agent outputs
  const intel: any = {
    scanned_at: new Date().toISOString(),
    mode: useFull ? "full" : "light",
    duration_ms: result.total_duration_ms,
    recent_videos: top.slice(0, 5).map(v => ({ title: v.title, views: v.views })),
    avg_views: Math.round(avgViews),
  };

  for (const out of result.all_outputs) {
    const parsed = safeParseJson(out.output);
    if (out.agent.includes("Scanner")) intel.scanner = parsed;
    else if (out.agent.includes("Pattern")) intel.patterns = parsed;
    else if (out.agent.includes("Strategist")) intel.strategy = parsed;
    else if (out.agent.includes("Evolution")) intel.evolution = parsed;
  }

  // 5. Save
  await sb.from("user_reference_channels").update({
    latest_intel: intel,
    last_scanned_at: new Date().toISOString(),
  }).eq("id", ref.id);

  return { ok: true, mode: intel.mode };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const { data: claims, error: authErr } = await sbAuth.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.force === true;
    const specificChannelId = body.channelId as string | undefined;

    let query = sb.from("user_reference_channels").select("*").eq("user_id", userId);
    if (specificChannelId) query = query.eq("id", specificChannelId);
    const { data: refs, error: refsErr } = await query;
    if (refsErr) throw refsErr;
    if (!refs || refs.length === 0) {
      return new Response(JSON.stringify({ refreshed: 0, message: "No reference channels" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    if (!YOUTUBE_API_KEY || !GOOGLE_AI_API_KEY) throw new Error("Missing API keys");

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    // Filter pending (skip recent unless forced or specific)
    const pending = refs.filter((ref: any) => {
      if (forceRefresh || specificChannelId) return true;
      return !ref.last_scanned_at || ref.last_scanned_at < sevenDaysAgo;
    });

    if (pending.length === 0) {
      return new Response(JSON.stringify({ refreshed: 0, total: refs.length, message: "All recent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in batches of 3 (parallel)
    const results: any[] = [];
    for (let i = 0; i < pending.length; i += 3) {
      const batch = pending.slice(i, i + 3);
      const settled = await Promise.allSettled(
        batch.map(ref => processChannel(sb, ref, YOUTUBE_API_KEY, GOOGLE_AI_API_KEY, LOVABLE_API_KEY, forceRefresh))
      );
      for (let j = 0; j < settled.length; j++) {
        const ref = batch[j];
        const s = settled[j];
        if (s.status === "fulfilled") {
          results.push({ channel: ref.channel_name, ...s.value });
        } else {
          console.error("[refresh-refs] failed", ref.channel_name, s.reason);
          results.push({ channel: ref.channel_name, ok: false, error: String(s.reason).slice(0, 200) });
        }
      }
    }

    const refreshed = results.filter(r => r.ok).length;
    return new Response(JSON.stringify({ refreshed, total: refs.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("refresh-references error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
