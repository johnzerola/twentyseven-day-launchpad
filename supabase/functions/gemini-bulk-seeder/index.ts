import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  return await callGeminiOpenAICompat(apiKey, body);
};

async function aiCall(prompt: string, toolDef: any): Promise<any> {
  const resp = await _ai({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are a YouTube analytics expert with deep knowledge of viral content across all niches globally. Generate realistic, diverse data. Always respond via the tool call." },
      { role: "user", content: prompt.slice(0, 12000) },
    ],
    tools: [toolDef],
    tool_choice: { type: "function", function: { name: toolDef.function.name } },
  });
  if (!resp.ok) throw new Error(`AI ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call returned");
  return JSON.parse(tc.function.arguments);
}

// ══════════ TOOL SCHEMAS ══════════

const TITLES_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_viral_titles",
    description: "Generate realistic viral YouTube titles with analytics",
    parameters: {
      type: "object",
      properties: {
        titles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              channel_name: { type: "string" },
              channel_id: { type: "string" },
              views: { type: "integer" },
              likes: { type: "integer" },
              niche: { type: "string" },
              language: { type: "string" },
              country: { type: "string" },
              duration_seconds: { type: "integer" },
              published_at: { type: "string" },
              why_viral: { type: "string" },
              title_pattern: { type: "string" },
              emotional_triggers: { type: "array", items: { type: "string" } },
              seo_score: { type: "number" },
              hook_type: { type: "string" },
              viral_score: { type: "number" },
            },
            required: ["title", "channel_name", "views", "niche", "language", "why_viral", "title_pattern", "emotional_triggers"],
            additionalProperties: false,
          },
        },
      },
      required: ["titles"],
      additionalProperties: false,
    },
  },
};

const CHANNELS_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_channels",
    description: "Generate realistic YouTube channel profiles",
    parameters: {
      type: "object",
      properties: {
        channels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              channel_name: { type: "string" },
              youtube_channel_id: { type: "string" },
              niche: { type: "string" },
              sub_niche: { type: "string" },
              language: { type: "string" },
              country: { type: "string" },
              subscribers: { type: "integer" },
              avg_views: { type: "integer" },
              style: { type: "string" },
              growth_rate: { type: "string" },
              is_faceless: { type: "boolean" },
              is_monetized: { type: "boolean" },
              upload_frequency: { type: "string" },
              content_category: { type: "string" },
              visual_style_notes: { type: "string" },
              top_videos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    views: { type: "integer" },
                    hook_text: { type: "string" },
                  },
                  required: ["title", "views"],
                  additionalProperties: false,
                },
              },
              viral_patterns: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pattern_name: { type: "string" },
                    pattern_json: { type: "object", properties: { hook_types: { type: "array", items: { type: "string" } }, emotional_triggers: { type: "array", items: { type: "string" } }, title_formulas: { type: "array", items: { type: "string" } }, success_factor: { type: "string" } }, required: ["hook_types", "success_factor"], additionalProperties: false },
                  },
                  required: ["pattern_name", "pattern_json"],
                  additionalProperties: false,
                },
              },
            },
            required: ["channel_name", "youtube_channel_id", "niche", "language", "country", "subscribers", "avg_views", "style", "is_faceless", "top_videos", "viral_patterns"],
            additionalProperties: false,
          },
        },
      },
      required: ["channels"],
      additionalProperties: false,
    },
  },
};

const DNA_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_content_dna",
    description: "Generate content DNA patterns for viral videos",
    parameters: {
      type: "object",
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              video_id: { type: "string" },
              video_title: { type: "string" },
              channel_name: { type: "string" },
              channel_id: { type: "string" },
              niche: { type: "string" },
              language: { type: "string" },
              views: { type: "integer" },
              subscribers: { type: "integer" },
              multiplier: { type: "number" },
              hook_type: { type: "string" },
              hook_pattern: { type: "string" },
              hook_strength: { type: "number" },
              title_structure: { type: "string" },
              title_uses_numbers: { type: "boolean" },
              title_uses_questions: { type: "boolean" },
              title_emotion: { type: "string" },
              story_structure: { type: "string" },
              pacing: { type: "string" },
              cliffhanger_count: { type: "integer" },
              open_loop_count: { type: "integer" },
              visual_style: { type: "string" },
              thumbnail_pattern: { type: "string" },
              emotion_primary: { type: "string" },
              emotion_secondary: { type: "string" },
              psychological_triggers: { type: "array", items: { type: "string" } },
              attention_score: { type: "number" },
              curiosity_score: { type: "number" },
              dopamine_score: { type: "number" },
              estimated_retention: { type: "number" },
              why_viral: { type: "string" },
              replication_template: { type: "string" },
              content_model: { type: "string" },
              viral_score: { type: "number" },
              video_type: { type: "string" },
              duration_seconds: { type: "integer" },
            },
            required: ["video_id", "video_title", "channel_name", "niche", "language", "views", "hook_type", "hook_strength", "title_structure", "story_structure", "pacing", "emotion_primary", "psychological_triggers", "attention_score", "curiosity_score", "dopamine_score", "estimated_retention", "why_viral", "viral_score"],
            additionalProperties: false,
          },
        },
      },
      required: ["entries"],
      additionalProperties: false,
    },
  },
};

// ══════════ NICHE POOLS ══════════

const NICHE_POOLS = {
  en: [
    "true crime", "unsolved mysteries", "dark history", "conspiracy theories debunked",
    "ancient civilizations", "mythology explained", "deep ocean exploration", "space and cosmos",
    "quantum physics", "psychology facts", "manipulation tactics", "body language analysis",
    "survival stories", "prison documentaries", "bank heist stories", "cult documentaries",
    "serial killer psychology", "paranormal investigation", "alien evidence", "nuclear disasters",
    "abandoned places", "military special forces", "espionage stories", "cold war secrets",
    "mafia documentaries", "drug cartel stories", "billionaire secrets", "stock market crashes",
    "crypto explained", "AI and future technology", "robot revolution", "medical mysteries",
    "forensic science", "animal behavior", "volcano eruptions", "earthquake survival",
    "shipwreck discoveries", "aviation disasters", "historical empires", "viking history",
    "samurai culture", "egyptian pharaohs", "roman gladiators", "medieval warfare",
    "pirate history", "wild west outlaws", "cold case solved", "wrongful convictions",
    "missing persons", "heist movies explained", "science experiments", "engineering marvels",
    "architecture wonders", "extreme weather", "tornado chasers", "deep cave exploration",
    "mountain climbing disasters", "ocean predators", "dinosaur discoveries", "genetic mutations",
    "brain science", "addiction psychology", "dream analysis", "memory techniques",
    "productivity hacks", "stoicism philosophy", "motivation mindset", "financial freedom",
    "real estate investing", "day trading", "passive income", "side hustle ideas",
    "cooking recipes", "food science", "restaurant reviews", "street food tours",
    "fitness transformation", "martial arts", "yoga wellness", "meditation techniques",
    "ASMR relaxation", "sleep stories", "white noise", "ambient music",
    "gaming speedruns", "retro gaming", "game lore explained", "esports highlights",
    "movie analysis", "film theory", "anime explained", "manga reviews",
    "book summaries", "philosophy explained", "art history", "music production",
    "guitar tutorials", "rap battles", "comedy sketches", "prank videos",
    "car reviews", "motorcycle adventures", "van life", "tiny house living",
    "gardening tips", "woodworking", "DIY home renovation", "3D printing projects",
  ],
  pt: [
    "crimes reais brasil", "mistérios não resolvidos", "história sombria brasil",
    "psicologia sombria", "manipulação mental", "linguagem corporal",
    "casos de polícia", "investigação forense", "desaparecimentos misteriosos",
    "história do brasil", "impérios antigos", "mitologia grega",
    "ciência explicada", "física quântica simplificada", "universo e cosmos",
    "oceano profundo", "animais perigosos", "desastres naturais",
    "sobrevivência extrema", "histórias de guerra", "segunda guerra mundial",
    "máfia italiana", "cartéis", "assaltos famosos",
    "tecnologia e IA", "futuro da humanidade", "criptomoedas",
    "investimentos", "renda passiva", "empreendedorismo digital",
    "finanças pessoais", "mercado imobiliário", "day trade",
    "receitas fáceis", "culinária brasileira", "churrasco perfeito",
    "fitness musculação", "emagrecimento", "saúde mental",
    "meditação", "estoicismo", "motivação e disciplina",
    "futebol análise", "UFC MMA", "curiosidades incríveis",
    "fatos surpreendentes", "teorias da conspiração", "ASMR português",
    "games brasil", "anime explicado", "filmes análise",
    "resumo de livros", "filosofia prática", "produtividade",
    "carros e motos", "viagens brasil", "vida minimalista",
  ],
  es: [
    "crímenes reales", "misterios sin resolver", "historia oscura",
    "psicología oscura", "manipulación mental", "lenguaje corporal",
    "casos criminales", "ciencia forense", "desapariciones misteriosas",
    "historia antigua", "imperios perdidos", "mitología explicada",
    "ciencia explicada", "física cuántica", "universo y cosmos",
    "océano profundo", "animales peligrosos", "desastres naturales",
    "supervivencia extrema", "historias de guerra", "narcotráfico",
    "mafia historias", "robos famosos", "espionaje secreto",
    "tecnología e IA", "futuro de la humanidad", "criptomonedas",
    "inversiones", "libertad financiera", "emprendimiento digital",
    "recetas fáciles", "cocina latina", "fitness transformación",
    "meditación", "estoicismo", "motivación y disciplina",
    "fútbol tácticas", "curiosidades increíbles", "teorías conspirativas",
    "anime explicado", "películas análisis", "resumen de libros",
    "filosofía práctica", "productividad", "viajes aventura",
  ],
};

// ══════════ MAIN HANDLER ══════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { target, batchSize = 30, language = "mixed" } = await req.json().catch(() => ({}));
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const report: Record<string, any> = {};
    const targets = target ? [target] : ["titles", "channels", "dna"];

    // Pick random niches per language
    const pickNiches = (lang: string, count: number) => {
      const pool = NICHE_POOLS[lang as keyof typeof NICHE_POOLS] || NICHE_POOLS.en;
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };

    const getNichesForBatch = () => {
      if (language === "mixed") {
        return [
          ...pickNiches("en", 3).map(n => ({ niche: n, lang: "en" })),
          ...pickNiches("pt", 2).map(n => ({ niche: n, lang: "pt" })),
          ...pickNiches("es", 1).map(n => ({ niche: n, lang: "es" })),
        ];
      }
      return pickNiches(language, 5).map(n => ({ niche: n, lang: language }));
    };

    // ── TITLES ──
    if (targets.includes("titles")) {
      const niches = getNichesForBatch();
      let inserted = 0, errors = 0;

      for (const { niche, lang } of niches) {
        try {
          const langLabel = lang === "pt" ? "Portuguese (Brazil)" : lang === "es" ? "Spanish" : "English";
          const prompt = `Generate ${batchSize} realistic viral YouTube titles for the "${niche}" niche in ${langLabel}.

Each title should represent a REAL video that could exist on YouTube with 500K+ views.
Include diverse channels (big and small). Mix title patterns: curiosity gap, numbers, urgency, controversy, storytelling, how-to, shock value, emotional hook.
Published dates should range from 2024-01 to 2026-04.
Views should range from 500K to 50M realistically.
Duration should be 180-1200 seconds for long-form.
Generate unique channel_id values like "UC" followed by 22 random alphanumeric characters.`;

          const result = await aiCall(prompt, TITLES_TOOL);
          const rows = (result.titles || []).map((t: any) => ({
            title: t.title,
            channel_name: t.channel_name || "Unknown",
            channel_id: t.channel_id || `UC${Math.random().toString(36).slice(2, 24)}`,
            views: t.views || 500000,
            likes: t.likes || Math.floor((t.views || 500000) * 0.03),
            niche: t.niche || niche,
            language: t.language || lang,
            country: t.country || (lang === "pt" ? "BR" : lang === "es" ? "ES" : "US"),
            duration_seconds: t.duration_seconds || 480,
            published_at: t.published_at || `2025-0${Math.floor(Math.random() * 9) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}T12:00:00Z`,
            why_viral: t.why_viral || null,
            title_pattern: t.title_pattern || null,
            emotional_triggers: t.emotional_triggers || [],
            seo_score: t.seo_score || 7,
            hook_type: t.hook_type || "curiosity",
            viral_score: t.viral_score || 70,
            source: "gemini-bulk-seeder",
          }));

          const { error } = await sb.from("viral_titles_db").insert(rows);
          if (!error) inserted += rows.length;
          else errors++;
        } catch (e) {
          console.error(`Titles error ${niche}:`, e);
          errors++;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      report.titles = { inserted, errors, niches: niches.length };
    }

    // ── CHANNELS ──
    if (targets.includes("channels")) {
      const niches = getNichesForBatch();
      let inserted = 0, errors = 0;

      for (const { niche, lang } of niches) {
        try {
          const langLabel = lang === "pt" ? "Portuguese (Brazil)" : lang === "es" ? "Spanish" : "English";
          const prompt = `Generate 15 realistic YouTube channels in the "${niche}" niche that create content in ${langLabel}.

Mix channel sizes: 3 large (1M+ subs), 5 medium (100K-1M), 4 small growing (10K-100K), 3 micro (1K-10K).
Each channel must have 3-5 top viral videos with realistic titles and view counts.
Include faceless and face channels. Various content styles: documentary, storytelling, educational, entertainment.
Generate unique youtube_channel_id values like "UC" followed by 22 random chars.
Include realistic upload frequencies, growth rates, and visual style descriptions.
Each channel needs 1-2 viral_patterns describing their successful formulas.`;

          const result = await aiCall(prompt, CHANNELS_TOOL);

          for (const ch of (result.channels || [])) {
            try {
              const { error } = await sb.from("channel_intelligence").upsert({
                channel_name: ch.channel_name,
                youtube_channel_id: ch.youtube_channel_id || `UC${Math.random().toString(36).slice(2, 24)}`,
                niche: ch.niche || niche,
                sub_niche: ch.sub_niche || null,
                language: ch.language || lang,
                country: ch.country || (lang === "pt" ? "BR" : lang === "es" ? "ES" : "US"),
                subscribers: ch.subscribers || 50000,
                avg_views: ch.avg_views || Math.floor(ch.subscribers * 0.1),
                style: ch.style || "documentary",
                growth_rate: ch.growth_rate || "moderate",
                is_faceless: ch.is_faceless ?? true,
                is_monetized: ch.is_monetized ?? (ch.subscribers > 1000),
                upload_frequency: ch.upload_frequency || "3x/week",
                content_category: ch.content_category || niche,
                visual_style_notes: ch.visual_style_notes || null,
                top_videos: ch.top_videos || [],
                viral_patterns: ch.viral_patterns || [],
                source: "gemini-bulk-seeder",
              }, { onConflict: "youtube_channel_id" });

              if (!error) inserted++;
              else errors++;
            } catch { errors++; }
          }
        } catch (e) {
          console.error(`Channels error ${niche}:`, e);
          errors++;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      report.channels = { inserted, errors, niches: niches.length };
    }

    // ── CONTENT DNA ──
    if (targets.includes("dna")) {
      const niches = getNichesForBatch();
      let inserted = 0, errors = 0;

      for (const { niche, lang } of niches) {
        try {
          const langLabel = lang === "pt" ? "Portuguese (Brazil)" : lang === "es" ? "Spanish" : "English";
          const prompt = `Generate 10 detailed content DNA analyses for viral YouTube videos in the "${niche}" niche (${langLabel}).

Each entry represents the deep analysis of a viral video (1M+ views). Include:
- Realistic video_id (11 chars alphanumeric), title, channel_name, channel_id
- Detailed hook analysis: type, pattern text, strength score
- Title structure analysis: pattern, uses numbers/questions, primary emotion
- Story structure and pacing analysis
- Psychological triggers used
- Attention/curiosity/dopamine scores (0-100)
- Estimated retention percentage
- Why it went viral (specific, not generic)
- Replication template for recreating the success
- Content model used (e.g., "mystery_reveal", "escalation", "hero_journey")
- Duration 180-900s, video_type "long" or "short"`;

          const result = await aiCall(prompt, DNA_TOOL);

          for (const entry of (result.entries || [])) {
            try {
              const { error } = await sb.from("content_dna").upsert({
                video_id: entry.video_id || `${Math.random().toString(36).slice(2, 13)}`,
                video_title: entry.video_title,
                channel_name: entry.channel_name || "Unknown",
                channel_id: entry.channel_id || `UC${Math.random().toString(36).slice(2, 24)}`,
                niche: entry.niche || niche,
                language: entry.language || lang,
                views: entry.views || 1000000,
                subscribers: entry.subscribers || 100000,
                multiplier: entry.multiplier || 5.0,
                hook_type: entry.hook_type,
                hook_pattern: entry.hook_pattern || null,
                hook_strength: entry.hook_strength,
                title_structure: entry.title_structure,
                title_uses_numbers: entry.title_uses_numbers || false,
                title_uses_questions: entry.title_uses_questions || false,
                title_emotion: entry.title_emotion || null,
                story_structure: entry.story_structure,
                pacing: entry.pacing,
                cliffhanger_count: entry.cliffhanger_count || 0,
                open_loop_count: entry.open_loop_count || 0,
                visual_style: entry.visual_style || null,
                thumbnail_pattern: entry.thumbnail_pattern || null,
                emotion_primary: entry.emotion_primary,
                emotion_secondary: entry.emotion_secondary || null,
                psychological_triggers: entry.psychological_triggers || [],
                attention_score: entry.attention_score,
                curiosity_score: entry.curiosity_score,
                dopamine_score: entry.dopamine_score,
                estimated_retention: entry.estimated_retention,
                why_viral: entry.why_viral,
                replication_template: entry.replication_template || null,
                content_model: entry.content_model || null,
                gold_score: entry.viral_score,
                viral_score: entry.viral_score,
                video_type: entry.video_type || "long",
                duration_seconds: entry.duration_seconds || 480,
                source: "gemini-bulk-seeder",
              }, { onConflict: "video_id" });

              if (!error) inserted++;
              else errors++;
            } catch { errors++; }
          }
        } catch (e) {
          console.error(`DNA error ${niche}:`, e);
          errors++;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      report.dna = { inserted, errors, niches: niches.length };
    }

    // Log
    await sb.from("execution_logs").insert({
      function_name: "gemini-bulk-seeder",
      success: true,
      metadata: report,
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gemini-bulk-seeder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
