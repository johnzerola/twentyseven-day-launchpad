import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════════
// ECONOMY CONFIG — Prevent runaway costs
// ═══════════════════════════════════════════════════════════════════
const MAX_RUNS_PER_DAY = 1;           // Once per day max
const MAX_CHANNELS_PER_NICHE = 3;     // Was 5
const MAX_NICHES_PER_RUN = 2;         // Was 4

const SCAN_CONFIGS = [
  { niche: "true crime", style: "horror", language: "en", queries: ["true crime faceless channel", "unsolved mysteries dark", "crime documentary animated"] },
  { niche: "horror", style: "horror", language: "en", queries: ["creepypasta narration new", "scary stories animated", "horror faceless channel 2026"] },
  { niche: "AI/tech", style: "cinematic", language: "en", queries: ["AI news faceless", "tech explained animation", "artificial intelligence channel 2026"] },
  { niche: "finance", style: "cinematic", language: "en", queries: ["finance faceless channel", "money explained animation", "crypto analysis faceless"] },
  { niche: "motivacional", style: "cinematic", language: "en", queries: ["dark motivation channel", "stoic motivation faceless", "motivational speech compilation"] },
  { niche: "space", style: "documentary", language: "en", queries: ["space documentary faceless", "universe explained", "astronomy facts channel"] },
  { niche: "curiosidades", style: "voce_sabia", language: "pt", queries: ["curiosidades faceless canal", "fatos incríveis canal", "canal dark curiosidades"] },
  { niche: "monetização-rápida", style: "pov", language: "en", queries: ["new youtube channel viral", "fastest growing faceless channel", "youtube shorts viral 2026"] },
  { niche: "histoire", style: "documentary", language: "fr", queries: ["documentaire faceless chaîne", "histoire sombre animation", "faits incroyables chaîne"] },
  { niche: "wissen", style: "cinematic", language: "de", queries: ["wissen faceless kanal", "fakten animation kanal", "dunkle fakten deutsch"] },
  { niche: "korece", style: "animation", language: "ko", queries: ["한국 팩트 채널", "다크 스토리 애니메이션", "무서운 이야기 채널"] },
  { niche: "türkçe", style: "cinematic", language: "tr", queries: ["karanlık gerçekler kanal", "gizemli hikayeler", "faceless türkçe kanal"] },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ═══════════════════════════════════════════════════════════════
    // THROTTLE — Max 1 run per day
    // ═══════════════════════════════════════════════════════════════
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayLogs } = await sb.from("execution_logs")
      .select("id")
      .eq("function_name", "auto-scan-channels")
      .eq("success", true)
      .gte("created_at", `${today}T00:00:00Z`);

    if ((todayLogs?.length || 0) >= MAX_RUNS_PER_DAY) {
      return new Response(JSON.stringify({
        success: true,
        throttled: true,
        reason: `Limite diário atingido (${todayLogs?.length}/${MAX_RUNS_PER_DAY})`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick random niches (reduced from 4 to 2)
    const shuffled = [...SCAN_CONFIGS].sort(() => Math.random() - 0.5);
    const selectedConfigs = shuffled.slice(0, MAX_NICHES_PER_RUN);

    let totalAnalyzed = 0;
    const results: string[] = [];

    for (const config of selectedConfigs) {
      const query = config.queries[Math.floor(Math.random() * config.queries.length)];

      try {
        // Check YouTube API quota
        const { data: ytAllowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
        if (!ytAllowed) {
          results.push(`⏳ ${config.niche}: YouTube quota atingida`);
          continue;
        }

        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&maxResults=5&order=viewCount`
        );
        const searchData = await searchRes.json();
        if (!searchData.items) continue;

        for (const item of searchData.items.slice(0, MAX_CHANNELS_PER_NICHE)) {
          const channelId = item.snippet.channelId;
          if (!channelId) continue;

          const { data: existing } = await sb.from("channel_intelligence")
            .select("id")
            .eq("youtube_channel_id", channelId)
            .maybeSingle();

          if (existing) continue;

          try {
            const analyzeRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-viral-channels`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ channelUrl: channelId }),
            });

            if (analyzeRes.ok) {
              totalAnalyzed++;
              results.push(`✅ ${item.snippet.channelTitle} (${config.niche})`);
            }
          } catch (e) {
            console.error(`Error analyzing ${channelId}:`, e);
          }

          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        console.error(`Scan error for ${config.niche}:`, e);
      }
    }

    // Viral titles — only 1 niche per run
    let titlesAdded = 0;
    const titleConfig = selectedConfigs[0];
    if (titleConfig) {
      try {
        const titleRes = await fetch(`${SUPABASE_URL}/functions/v1/build-viral-titles-db`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ niche: titleConfig.niche, country: "US", language: titleConfig.language, minViews: 350000, maxResults: 10 }),
        });
        if (titleRes.ok) {
          const titleData = await titleRes.json();
          titlesAdded += titleData.inserted || 0;
        }
      } catch (e) {
        console.error(`Title scan error:`, e);
      }
    }

    // Log
    await sb.from("execution_logs").insert({
      function_name: "auto-scan-channels",
      success: true,
      duration_ms: 0,
      metadata: { analyzed: totalAnalyzed, titlesAdded, niches: selectedConfigs.map(c => c.niche), results },
    });

    return new Response(JSON.stringify({
      success: true,
      analyzed: totalAnalyzed,
      titlesAdded,
      niches_scanned: selectedConfigs.map(c => c.niche),
      results,
      economy_mode: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-scan-channels error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
