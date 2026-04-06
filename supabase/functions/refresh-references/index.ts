import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user
    let userId: string;
    const token = authHeader?.replace("Bearer ", "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: { user }, error } = await sb.auth.getUser(token);
      if (error || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      userId = user.id;
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.force === true;
    const specificChannelId = body.channelId as string | undefined;

    // Fetch user's reference channels
    let query = sb.from("user_reference_channels").select("*").eq("user_id", userId);
    if (specificChannelId) query = query.eq("id", specificChannelId);
    const { data: refs, error: refsErr } = await query;
    if (refsErr) throw refsErr;
    if (!refs || refs.length === 0) {
      return new Response(JSON.stringify({ refreshed: 0, message: "No reference channels" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!YOUTUBE_API_KEY || !GOOGLE_AI_API_KEY) throw new Error("Missing API keys");

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    let refreshed = 0;

    for (const ref of refs) {
      // Skip if scanned recently (unless forced)
      if (!forceRefresh && ref.last_scanned_at && ref.last_scanned_at > sevenDaysAgo) continue;

      try {
        // 1. Fetch latest 10 videos from YouTube
        const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${ref.youtube_channel_id}&order=date&maxResults=10&type=video&key=${YOUTUBE_API_KEY}`;
        const ytRes = await fetch(ytUrl);
        if (!ytRes.ok) { console.error("YT error for", ref.channel_name, ytRes.status); continue; }
        const ytData = await ytRes.json();
        const videoIds = (ytData.items || []).map((i: any) => i.id.videoId).filter(Boolean);

        if (videoIds.length === 0) continue;

        // 2. Get video stats
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`;
        const statsRes = await fetch(statsUrl);
        const statsData = await statsRes.json();
        const videos = (statsData.items || []).map((v: any) => ({
          title: v.snippet?.title,
          views: parseInt(v.statistics?.viewCount || "0"),
          likes: parseInt(v.statistics?.likeCount || "0"),
          comments: parseInt(v.statistics?.commentCount || "0"),
          published: v.snippet?.publishedAt,
          duration: v.contentDetails?.duration,
        }));

        // 3. Gemini Flash extracts patterns
        const prompt = `Analyze these ${videos.length} recent videos from the channel "${ref.channel_name}" (role: ${ref.role}).

Videos:
${videos.map((v: any, i: number) => `${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views, ${v.likes} likes, ${v.comments} comments, published ${v.published}`).join("\n")}

Extract COMPACT intel (max 500 chars per field):`;

        const aiRes = await callGeminiOpenAICompat(GOOGLE_AI_API_KEY, {
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Return ONLY valid JSON." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_channel_intel",
              description: "Extract patterns from recent videos",
              parameters: {
                type: "object",
                properties: {
                  title_patterns: { type: "array", items: { type: "string" }, description: "3-5 title patterns/formulas used (e.g. 'Number + Superlative + Topic')" },
                  hook_types: { type: "array", items: { type: "string" }, description: "2-4 dominant hook styles" },
                  avg_duration_minutes: { type: "number" },
                  dominant_format: { type: "string", description: "e.g. listicle, documentary, storytelling" },
                  top_performing_elements: { type: "array", items: { type: "string" }, description: "3 elements from best-performing videos" },
                  format_shift: { type: "string", description: "Any recent strategy change detected (or 'none')" },
                  best_video: { type: "object", properties: { title: { type: "string" }, views: { type: "number" } } },
                  posting_frequency: { type: "string", description: "e.g. '3x/week', 'daily'" },
                },
                required: ["title_patterns", "hook_types", "dominant_format", "top_performing_elements"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_channel_intel" } },
        });

        let intel: any = {};
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            try { intel = JSON.parse(toolCall.function.arguments); } catch { /* empty */ }
          }
        }

        // Add raw video summaries for context injection
        intel.recent_videos = videos.slice(0, 5).map((v: any) => ({ title: v.title, views: v.views }));
        intel.scanned_at = new Date().toISOString();

        // 4. Update the reference
        await sb.from("user_reference_channels").update({
          latest_intel: intel,
          last_scanned_at: new Date().toISOString(),
        }).eq("id", ref.id);

        refreshed++;
      } catch (err) {
        console.error("Error refreshing", ref.channel_name, err);
      }
    }

    return new Response(JSON.stringify({ refreshed, total: refs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("refresh-references error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
