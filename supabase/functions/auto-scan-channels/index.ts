import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Niches and queries to rotate weekly
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

    // Pick 3-4 random niches to scan each week (to avoid quota exhaustion)
    const shuffled = [...SCAN_CONFIGS].sort(() => Math.random() - 0.5);
    const selectedConfigs = shuffled.slice(0, 4);

    let totalAnalyzed = 0;
    const results: string[] = [];

    for (const config of selectedConfigs) {
      const query = config.queries[Math.floor(Math.random() * config.queries.length)];

      try {
        // Search YouTube for channels
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&maxResults=10&order=viewCount`
        );
        const searchData = await searchRes.json();
        if (!searchData.items) continue;

        for (const item of searchData.items.slice(0, 5)) {
          const channelId = item.snippet.channelId;
          if (!channelId) continue;

          // Check if already exists
          const { data: existing } = await sb.from("channel_intelligence")
            .select("id")
            .eq("youtube_channel_id", channelId)
            .maybeSingle();

          if (existing) continue;

          // Call analyze-viral-channels via internal invoke
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
            } else {
              const errText = await analyzeRes.text();
              console.error(`Failed ${item.snippet.channelTitle}: ${errText}`);
            }
          } catch (e) {
            console.error(`Error analyzing ${channelId}:`, e);
          }

          // Rate limit: wait 2s between channels
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        console.error(`Scan error for ${config.niche}:`, e);
      }
    }

    // === Also populate viral_titles_db ===
    let titlesAdded = 0;
    for (const config of selectedConfigs) {
      try {
        const titleRes = await fetch(`${SUPABASE_URL}/functions/v1/build-viral-titles-db`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ niche: config.niche, country: "US", language: config.language, minViews: 350000, maxResults: 15 }),
        });
        if (titleRes.ok) {
          const titleData = await titleRes.json();
          titlesAdded += titleData.inserted || 0;
        }
      } catch (e) {
        console.error(`Title scan error for ${config.niche}:`, e);
      }
    }

    // Log summary
    console.log(`Auto-scan complete: ${totalAnalyzed} new channels, ${titlesAdded} new viral titles`);

    return new Response(JSON.stringify({
      success: true,
      analyzed: totalAnalyzed,
      titlesAdded,
      niches_scanned: selectedConfigs.map(c => c.niche),
      results,
      timestamp: new Date().toISOString(),
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
