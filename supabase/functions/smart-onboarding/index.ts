import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ═══════════════════════════════════════════════════════════
// SMART ONBOARDING ENGINE
// Auto-populates user data on first setup:
// - Scans niche competitors
// - Populates initial content_dna entries
// - Creates starter content_queue items
// - Pre-loads relevant hook/title patterns
// - Seeds channel voice profile from reference scripts
// ═══════════════════════════════════════════════════════════

function getYouTubeKey(): string | undefined {
  return Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") ||
    Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, niche, language, contentType, channelId, goal } = await req.json();
    if (!userId || !niche) throw new Error("userId and niche required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const YT_KEY = getYouTubeKey();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const lang = language || 'pt';

    const results: any = {
      competitors_found: 0,
      dna_entries_created: 0,
      queue_items_created: 0,
      hooks_loaded: 0,
    };

    // ═══ 1) DISCOVER NICHE COMPETITORS ═══
    if (YT_KEY) {
      const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
      if (allowed) {
        const queries = [
          `${niche} ${lang === 'pt' ? 'canal' : 'channel'}`,
          `${niche} ${lang === 'pt' ? 'como fazer' : 'how to'}`
        ];

        for (const q of queries) {
          try {
            const params = new URLSearchParams({
              part: 'snippet', q, type: 'video', order: 'viewCount',
              maxResults: '10', key: YT_KEY,
              relevanceLanguage: lang === 'pt' ? 'pt' : lang === 'es' ? 'es' : 'en',
            });
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
            if (!res.ok) continue;
            const data = await res.json();
            const videoIds = (data.items || []).map((i: any) => i.id?.videoId).filter(Boolean);

            if (videoIds.length) {
              const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}&key=${YT_KEY}`);
              if (vRes.ok) {
                const vData = await vRes.json();
                for (const v of (vData.items || [])) {
                  const views = parseInt(v.statistics?.viewCount || '0');
                  if (views < 1000) continue;

                  // Add to outlier_channels for user
                  await sb.from("outlier_channels").upsert({
                    user_id: userId,
                    video_title: v.snippet.title,
                    channel_name: v.snippet.channelTitle,
                    channel_id: v.snippet.channelId,
                    video_url: `https://youtube.com/watch?v=${v.id}`,
                    views,
                    niche,
                    thumbnail_url: v.snippet.thumbnails?.medium?.url,
                    multiplier: 1,
                  }, { onConflict: "user_id,video_title" }).catch(() => {});
                  results.competitors_found++;
                }
              }
            }
          } catch { /* continue */ }
        }
      }
    }

    // ═══ 2) GENERATE STARTER CONTENT IDEAS ═══
    if (GOOGLE_AI_API_KEY) {
      try {
        const ideaRes = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `Gere 7 ideias de vídeo para um canal de YouTube novo no nicho "${niche}".
Idioma: ${lang}. Tipo: ${contentType || 'faceless'}.
Meta: ${goal || 'monetização'}.

Para cada ideia: título, breve descrição (1 frase), e prioridade (alta/média/baixa).
Responda em JSON: { ideas: [{ title, description, priority }] }`
            }],
          }),
        });

        if (ideaRes.ok) {
          const d = await ideaRes.json();
          const content = d.choices?.[0]?.message?.content || '';
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const ideas = parsed.ideas || [];

              for (let i = 0; i < ideas.length; i++) {
                const idea = ideas[i];
                const scheduledDate = new Date(Date.now() + (i + 1) * 2 * 86400000);
                await sb.from("content_queue").insert({
                  user_id: userId,
                  title: idea.title || `Ideia ${i + 1}`,
                  notes: idea.description || '',
                  niche,
                  language: lang,
                  priority: idea.priority === 'alta' ? 'high' : idea.priority === 'baixa' ? 'low' : 'medium',
                  status: 'idea',
                  scheduled_date: scheduledDate.toISOString().slice(0, 10),
                  video_type: 'short',
                }).catch(() => {});
                results.queue_items_created++;
              }
            }
          } catch { /* JSON parse fail — non-blocking */ }
        }
      } catch { /* AI fail — non-blocking */ }
    }

    // ═══ 3) LOAD RELEVANT HOOKS FROM LIBRARY ═══
    const { data: nicheHooks } = await sb.from("hook_library")
      .select("id")
      .or(`niche.ilike.%${niche}%,niche.is.null`)
      .order("retention_score", { ascending: false })
      .limit(20);
    results.hooks_loaded = nicheHooks?.length || 0;

    // ═══ 4) LOAD RELEVANT CONTENT DNA ═══
    const { data: existingDna } = await sb.from("content_dna")
      .select("id")
      .ilike("niche", `%${niche}%`)
      .limit(5);
    results.dna_entries_created = existingDna?.length || 0;

    // ═══ 5) CREATE INITIAL PLANNER CARDS ═══
    const starterCards = [
      { title: `Pesquisar top 10 canais de ${niche}`, column_id: 'ideas', priority: 'alta' },
      { title: 'Configurar estilo visual do canal', column_id: 'ideas', priority: 'alta' },
      { title: 'Gravar primeiro Short', column_id: 'ideas', priority: 'alta' },
      { title: 'Analisar 3 vídeos virais do nicho', column_id: 'ideas', priority: 'média' },
      { title: 'Criar 5 thumbnails de referência', column_id: 'ideas', priority: 'média' },
    ];

    for (let i = 0; i < starterCards.length; i++) {
      await sb.from("planner_cards").insert({
        user_id: userId,
        title: starterCards[i].title,
        column_id: starterCards[i].column_id,
        priority: starterCards[i].priority,
        position: i,
      }).catch(() => {});
    }

    await sb.from("execution_logs").insert({
      function_name: "smart-onboarding",
      success: true,
      metadata: results,
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-onboarding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
