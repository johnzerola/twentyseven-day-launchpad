import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== TOOL DEFINITIONS =====
const DOTTI_TOOLS = [
  {
    type: "function",
    function: {
      name: "dubspy_search",
      description: "Search YouTube videos and channels using DubSpy. Use when user asks to find channels, videos, trends, or wants competitive research in any niche/country.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (niche, topic, or keyword)" },
          country: { type: "string", description: "Country code (BR, US, PL, TR, etc.)" },
          language: { type: "string", description: "Language code (pt, en, pl, tr, etc.)" },
          mode: { type: "string", enum: ["videos", "channels", "emerging", "escapees", "micro_niche"], description: "Search mode" },
          min_views: { type: "number", description: "Minimum views filter" },
          max_subs: { type: "number", description: "Maximum subscribers filter (for finding small channels)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_niche",
      description: "Analyze a niche using the Niche Explorer. Returns RPM, saturation, difficulty, top channels, and opportunity score. Use when user asks about niche viability.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "The niche to analyze" },
          country: { type: "string", description: "Country code (BR, US, PL, etc.)" },
          language: { type: "string", description: "Language code" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_channel",
      description: "Analyze a specific YouTube channel. Returns subscribers, views, upload frequency, top videos, viral patterns, and SWOT. Use when user provides a channel URL or name.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", description: "YouTube channel URL, @handle, or channel ID" },
        },
        required: ["channel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reverse_engineer_video",
      description: "Reverse-engineer a YouTube video to extract hook structure, pacing, retention curve, psychological triggers. Use when user shares a video URL.",
      parameters: {
        type: "object",
        properties: {
          video_url: { type: "string", description: "YouTube video URL or ID" },
        },
        required: ["video_url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_outliers",
      description: "Find outlier videos in a niche — small channels with viral videos (views >> subscribers). Use for finding replicable opportunities.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche to search" },
          country: { type: "string", description: "Country code" },
          min_multiplier: { type: "number", description: "Minimum views/subs multiplier (default 5)" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_titles",
      description: "Generate viral title suggestions for a topic. Returns titles with estimated CTR and SEO analysis. Use when user needs title ideas.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Video topic" },
          niche: { type: "string", description: "Niche category" },
          language: { type: "string", description: "Language for titles" },
          style: { type: "string", description: "Title style (curiosity, listicle, challenge, etc.)" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_viral_database",
      description: "Search the internal viral titles database (900+ real viral titles). Returns titles with views, patterns, emotional triggers. Use for pattern discovery.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (niche, keyword, pattern)" },
          niche: { type: "string", description: "Filter by niche" },
          country: { type: "string", description: "Filter by country" },
          min_views: { type: "number", description: "Minimum views" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "channel_intelligence_search",
      description: "Search the channel intelligence database (650+ analyzed channels). Find channels by niche, country, style, or growth pattern.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche filter" },
          country: { type: "string", description: "Country code filter" },
          is_faceless: { type: "boolean", description: "Filter faceless channels only" },
          min_subscribers: { type: "number", description: "Minimum subscribers" },
          growth_rate: { type: "string", description: "Growth rate filter (fast, steady, explosive)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_revenue",
      description: "Estimate revenue for a channel or niche based on views, RPM, and country. Use when user asks about money/earnings potential.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche" },
          country: { type: "string", description: "Country code" },
          monthly_views: { type: "number", description: "Estimated monthly views" },
          subscribers: { type: "number", description: "Current or target subscribers" },
        },
        required: ["niche", "country"],
      },
    },
  },
];

// Generate query embedding
async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `You are an embedding generator. Given text, output ONLY a JSON array of exactly 768 floating-point numbers between -1 and 1 that represent the semantic meaning of the text. Output ONLY the JSON array, nothing else.` },
          { role: "user", content: text.slice(0, 1000) }
        ],
        tools: [{
          type: "function",
          function: {
            name: "store_embedding",
            description: "Store a 768-dimensional embedding vector",
            parameters: {
              type: "object",
              properties: { embedding: { type: "array", items: { type: "number" }, description: "768-dimensional embedding vector" } },
              required: ["embedding"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "store_embedding" } },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    const args = JSON.parse(toolCall.function.arguments);
    let embedding = args.embedding;
    if (!Array.isArray(embedding)) return null;
    if (embedding.length < 768) while (embedding.length < 768) embedding.push(0);
    else if (embedding.length > 768) embedding = embedding.slice(0, 768);
    const mag = Math.sqrt(embedding.reduce((s: number, v: number) => s + v * v, 0));
    if (mag > 0) embedding = embedding.map((v: number) => v / mag);
    return embedding;
  } catch (e) {
    console.error("Query embedding error:", e);
    return null;
  }
}

// ===== TOOL EXECUTION =====
async function executeTool(
  toolName: string,
  args: any,
  sb: any,
  supabaseUrl: string,
  serviceKey: string
): Promise<string> {
  const callFn = async (fnName: string, payload: any) => {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      try { return JSON.parse(text); } catch { return { raw: text.slice(0, 2000) }; }
    } catch (e: any) {
      return { error: e.message };
    }
  };

  try {
    switch (toolName) {
      case "dubspy_search": {
        const result = await callFn("dubspy-scan", {
          query: args.query,
          country: args.country || "BR",
          language: args.language || "pt",
          mode: args.mode || "videos",
          min_views: args.min_views,
          max_subs: args.max_subs,
        });
        return JSON.stringify(result).slice(0, 8000);
      }

      case "analyze_niche": {
        const result = await callFn("niche-explorer", {
          niche: args.niche,
          country: args.country || "BR",
          language: args.language || "pt",
        });
        return JSON.stringify(result).slice(0, 6000);
      }

      case "analyze_channel": {
        const result = await callFn("analyze-channel", {
          channelInput: args.channel,
        });
        return JSON.stringify(result).slice(0, 8000);
      }

      case "reverse_engineer_video": {
        const videoId = args.video_url.replace(/.*(?:v=|youtu\.be\/)/, '').replace(/[&?].*/, '');
        const result = await callFn("reverse-engineer-video", {
          videoId,
        });
        return JSON.stringify(result).slice(0, 8000);
      }

      case "find_outliers": {
        const result = await callFn("find-outliers", {
          niche: args.niche,
          country: args.country || "BR",
          minMultiplier: args.min_multiplier || 5,
        });
        return JSON.stringify(result).slice(0, 6000);
      }

      case "generate_titles": {
        const result = await callFn("generate-titles", {
          topic: args.topic,
          niche: args.niche || "",
          language: args.language || "português",
          style: args.style || "mixed",
        });
        return JSON.stringify(result).slice(0, 4000);
      }

      case "search_viral_database": {
        // Search viral_titles_db directly
        let query = sb.from("viral_titles_db")
          .select("title, views, niche, country, language, emotional_triggers, title_pattern, why_viral, channel_name")
          .order("views", { ascending: false })
          .limit(20);
        
        if (args.niche) query = query.ilike("niche", `%${args.niche}%`);
        if (args.country) query = query.eq("country", args.country);
        if (args.min_views) query = query.gte("views", args.min_views);
        if (args.query) query = query.or(`title.ilike.%${args.query}%,niche.ilike.%${args.query}%`);
        
        const { data } = await query;
        return JSON.stringify(data || []).slice(0, 6000);
      }

      case "channel_intelligence_search": {
        let query = sb.from("channel_intelligence")
          .select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country, language, upload_frequency, youtube_channel_id")
          .order("avg_views", { ascending: false })
          .limit(20);
        
        if (args.niche) query = query.ilike("niche", `%${args.niche}%`);
        if (args.country) query = query.eq("country", args.country);
        if (args.is_faceless !== undefined) query = query.eq("is_faceless", args.is_faceless);
        if (args.min_subscribers) query = query.gte("subscribers", args.min_subscribers);
        if (args.growth_rate) query = query.eq("growth_rate", args.growth_rate);
        
        const { data } = await query;
        return JSON.stringify(data || []).slice(0, 6000);
      }

      case "estimate_revenue": {
        const result = await callFn("estimate-revenue", {
          niche: args.niche,
          country: args.country,
          monthly_views: args.monthly_views || 100000,
          subscribers: args.subscribers || 10000,
        });
        return JSON.stringify(result).slice(0, 3000);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (e: any) {
    console.error(`Tool ${toolName} error:`, e);
    return JSON.stringify({ error: e.message });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, currentPage, mode, onboardingData, conversationId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Extract user_id from JWT
    let currentUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payloadB64 = authHeader.slice(7).split('.')[1];
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        currentUserId = payload.sub || null;
      } catch { /* ignore */ }
    }

    // ===== FETCH USER-SPECIFIC DATA =====
    let userProfileContext = '';
    if (currentUserId) {
      const [userChannels, savedSearches, savedScripts, savedTitles, outliers, onboardingPlan, plannerCards, trackedChannels] = await Promise.all([
        sb.from("user_channels").select("channel_name, niche, subscribers, views, videos, youtube_channel_id, analysis_json").eq("user_id", currentUserId).limit(10),
        sb.from("saved_searches").select("query, tab, notes, filters_json, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(15),
        sb.from("saved_scripts").select("topic, style, video_type, duration, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(10),
        sb.from("saved_titles").select("topic, niche, titles_json, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(10),
        sb.from("outlier_channels").select("video_title, channel_name, views, multiplier, niche").eq("user_id", currentUserId).order("found_at", { ascending: false }).limit(10),
        sb.from("onboarding_plans").select("niche, goal, language, content_type, time_per_day, plan_json").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(1),
        sb.from("planner_cards").select("title, column_id, priority, tags").eq("user_id", currentUserId).order("updated_at", { ascending: false }).limit(15),
        sb.from("tracked_channels").select("channel_name, youtube_channel_id, subscribers, folder").eq("user_id", currentUserId).limit(20),
      ]);

      const blocks: string[] = [];
      if (userChannels.data?.length) {
        blocks.push(`### 📺 Canais do Usuário (${userChannels.data.length}):\n` +
          userChannels.data.map(c => {
            const analysis = c.analysis_json ? ` | Análise: ${JSON.stringify(c.analysis_json).slice(0, 200)}` : '';
            return `- ${c.channel_name} (${c.niche || '?'}): ${(c.subscribers || 0)/1000}K subs, ${(c.views || 0)/1000}K views, ${c.videos || 0} vídeos${analysis}`;
          }).join('\n'));
      }
      if (trackedChannels.data?.length) {
        blocks.push(`### 👀 Canais Rastreados (${trackedChannels.data.length}):\n` +
          trackedChannels.data.map(c => `- ${c.channel_name} (${(c.subscribers || 0)/1000}K subs)${c.folder ? ` [${c.folder}]` : ''}`).join('\n'));
      }
      if (onboardingPlan.data?.length) {
        const plan = onboardingPlan.data[0];
        blocks.push(`### 🎯 Plano do Usuário:\n- Nicho: ${plan.niche || '?'}\n- Meta: ${plan.goal || '?'}\n- Idioma: ${plan.language || '?'}\n- Tipo: ${plan.content_type || '?'}\n- Tempo/dia: ${plan.time_per_day || '?'}`);
      }
      if (savedSearches.data?.length) {
        blocks.push(`### 🔍 Pesquisas Recentes (${savedSearches.data.length}):\n` +
          savedSearches.data.slice(0, 8).map(s => `- "${s.query}" (${s.tab})${s.notes ? ` — ${s.notes}` : ''}`).join('\n'));
      }
      if (savedScripts.data?.length) {
        blocks.push(`### ✍️ Roteiros Salvos (${savedScripts.data.length}):\n` +
          savedScripts.data.map(s => `- "${s.topic}" (${s.video_type}, ${s.duration}min, ${s.style || '?'})`).join('\n'));
      }
      if (savedTitles.data?.length) {
        blocks.push(`### 🏷️ Títulos Salvos (${savedTitles.data.length}):\n` +
          savedTitles.data.map(t => {
            const titles = Array.isArray(t.titles_json) ? t.titles_json.slice(0, 3).map((tt: any) => typeof tt === 'string' ? tt : tt.title || '').join('; ') : '';
            return `- "${t.topic || '?'}" (${t.niche || '?'}) → ${titles}`;
          }).join('\n'));
      }
      if (outliers.data?.length) {
        blocks.push(`### 🚀 Outliers Encontrados (${outliers.data.length}):\n` +
          outliers.data.map(o => `- "${o.video_title}" de ${o.channel_name || '?'} — ${(o.views || 0)/1000}K views, ${o.multiplier}x`).join('\n'));
      }
      if (plannerCards.data?.length) {
        const byColumn: Record<string, string[]> = {};
        plannerCards.data.forEach(c => {
          if (!byColumn[c.column_id]) byColumn[c.column_id] = [];
          byColumn[c.column_id].push(`${c.title} [${c.priority || 'média'}]`);
        });
        blocks.push(`### 📋 Tarefas:\n` + Object.entries(byColumn).map(([col, items]) => `**${col}**: ${items.join(', ')}`).join('\n'));
      }
      if (blocks.length > 0) {
        userProfileContext = `\n## 👤 PERFIL DO USUÁRIO\n${blocks.join('\n\n')}`;
      }
    }

    // ===== SEMANTIC SEARCH =====
    const userMessages = (messages || []).filter((m: any) => m.role === 'user');
    const latestQuery = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
    const recentContext = userMessages.slice(-3).map((m: any) => m.content).join(' ');

    let semanticContext = '';
    let usedSemantic = false;

    const queryEmbedding = await generateQueryEmbedding(recentContext || latestQuery, LOVABLE_API_KEY);
    if (queryEmbedding) {
      const { data: matches, error: matchError } = await sb.rpc('match_knowledge', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_count: 30,
        match_threshold: 0.25,
      });
      if (!matchError && matches?.length > 0) {
        usedSemantic = true;
        const grouped: Record<string, any[]> = {};
        for (const m of matches) {
          if (!grouped[m.source_table]) grouped[m.source_table] = [];
          grouped[m.source_table].push(m);
        }
        const tableLabels: Record<string, string> = {
          youtube_knowledge: '📚 Algoritmo YouTube', script_knowledge: '✍️ Técnicas de Roteiro',
          hook_library: '🎣 Hooks', audience_psychology_patterns: '🧬 Psicologia',
          attention_engineering: '⚡ Engenharia de Atenção', content_models: '🎬 Modelos',
          script_structures: '📐 Estruturas', hook_patterns: '🧠 Padrões de Hook',
          scene_prompt_knowledge: '🎥 Prompts Visuais', niche_database: '📊 Nichos',
          viral_titles_db: '🔥 Títulos Virais', attention_library: '👁️ Atenção',
        };
        const contextBlocks: string[] = [];
        for (const [table, items] of Object.entries(grouped)) {
          const label = tableLabels[table] || table;
          const block = items.sort((a, b) => b.similarity - a.similarity)
            .map(m => `  [${(m.similarity * 100).toFixed(0)}%] ${m.content_text.slice(0, 300)}`).join('\n');
          contextBlocks.push(`### ${label} (${items.length}):\n${block}`);
        }
        semanticContext = contextBlocks.join('\n\n');
      }
    }

    // Fetch essential data
    const [channelIntel, viralTitles, nicheDb] = await Promise.all([
      sb.from("channel_intelligence").select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country, language, upload_frequency").limit(40),
      sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern, channel_name, country, language, why_viral").order("views", { ascending: false }).limit(30),
      sb.from("niche_database").select("name, rpm_estimate, difficulty, saturation, faceless_friendly, country, language, sub_niches").limit(60),
    ]);

    const channelContext = (channelIntel.data || []).map(c =>
      `${c.channel_name} (${c.niche}): ${(c.avg_views/1000).toFixed(0)}K views, ${(c.subscribers/1000).toFixed(0)}K subs, RPM $${c.rpm_estimate}, ${c.growth_rate}, ${c.is_faceless ? 'faceless' : 'facecam'}, ${c.country}`
    ).join('\n');

    const viralContext = (viralTitles.data || []).map(v =>
      `"${v.title}" — ${(v.views/1000).toFixed(0)}K views, ${v.niche}, ${v.country || '?'}, triggers: ${(v.emotional_triggers || []).join(', ')}`
    ).join('\n');

    const nicheContext = (nicheDb.data || []).map(n =>
      `${n.name}: RPM $${n.rpm_estimate}, ${n.difficulty}, saturação ${n.saturation}, faceless: ${n.faceless_friendly ? 'sim' : 'não'}, ${n.country}`
    ).join('\n');

    let fallbackContext = '';
    if (!usedSemantic) {
      const [ytK, scriptK, hookL, attE, audP, contM, scriptS, hookP, attL, sceneK] = await Promise.all([
        sb.from("youtube_knowledge").select("title, content, category, priority").order("priority", { ascending: false }).limit(25),
        sb.from("script_knowledge").select("title, content, category, effectiveness_score").order("effectiveness_score", { ascending: false }).limit(20),
        sb.from("hook_library").select("hook_text, hook_type, niche, retention_score").order("retention_score", { ascending: false }).limit(30),
        sb.from("attention_engineering").select("pattern_name, technique, category, retention_impact").order("retention_impact", { ascending: false }).limit(20),
        sb.from("audience_psychology_patterns").select("trigger_type, description, storytelling_pattern, retention_score").order("retention_score", { ascending: false }).limit(20),
        sb.from("content_models").select("model_name, model_type, description, hook_pattern, effectiveness_score, video_type").order("effectiveness_score", { ascending: false }).limit(15),
        sb.from("script_structures").select("structure_name, intro_pattern, middle_pattern, ending_pattern, avg_retention, niche").order("effectiveness_score", { ascending: false }).limit(15),
        sb.from("hook_patterns").select("pattern_name, pattern_type, template, psychology_trigger, avg_retention_boost").order("effectiveness_score", { ascending: false }).limit(20),
        sb.from("attention_library").select("pattern_name, scene_type, attention_score, emotion, time_window, example_text").order("attention_score", { ascending: false }).limit(20),
        sb.from("scene_prompt_knowledge").select("title, category, prompt_template, viral_score").order("viral_score", { ascending: false }).limit(15),
      ]);
      fallbackContext = `
### 📚 Algoritmo YouTube:\n${(ytK.data || []).map(k => `[${k.category}] ${k.title}: ${k.content.slice(0, 400)}`).join('\n')}
### ✍️ Roteiro:\n${(scriptK.data || []).map(k => `${k.title} (${k.effectiveness_score}): ${k.content.slice(0, 300)}`).join('\n')}
### 🎣 Hooks:\n${(hookL.data || []).map(h => `[${h.hook_type}] "${h.hook_text}" — ${h.retention_score}/10`).join('\n')}
### ⚡ Atenção:\n${(attE.data || []).map(a => `${a.pattern_name}: ${a.technique} | ${a.retention_impact}%`).join('\n')}
### 🧬 Psicologia:\n${(audP.data || []).map(p => `[${p.trigger_type}] ${p.description.slice(0, 200)}`).join('\n')}
### 🎬 Modelos:\n${(contM.data || []).map(m => `${m.model_name} (${m.video_type}): ${m.description.slice(0, 150)}`).join('\n')}
### 📐 Estruturas:\n${(scriptS.data || []).map(s => `${s.structure_name}: intro="${s.intro_pattern.slice(0, 80)}" | ${s.avg_retention}%`).join('\n')}
### 🧠 Hook Patterns:\n${(hookP.data || []).map(h => `${h.pattern_name}: "${h.template}" +${h.avg_retention_boost}%`).join('\n')}
### 👁️ Cenas:\n${(attL.data || []).map(a => `${a.pattern_name} ${a.time_window}: ${a.attention_score}/10`).join('\n')}
### 🎥 Prompts:\n${(sceneK.data || []).map(s => `[${s.category}] ${s.title}: ${s.prompt_template.slice(0, 150)}`).join('\n')}`;
    }

    const pageHints: Record<string, string> = {
      '/scripts': 'O usuário está na página de ROTEIROS.',
      '/titles': 'O usuário está na página de TÍTULOS.',
      '/search': 'O usuário está no DubSpy.',
      '/niches': 'O usuário está no Niche Explorer.',
      '/branding': 'O usuário está no Growth Center.',
      '/workflow': 'O usuário está no Production Hub.',
      '/channels': 'O usuário está em Meus Canais.',
      '/viral-db': 'O usuário está na Viral Database.',
      '/dashboard': 'O usuário está no Dashboard.',
      '/multichannel': 'O usuário está no Multichannel Manager.',
    };
    const pageContext = pageHints[currentPage] || '';

    // ========== ONBOARDING MODE ==========
    if (mode === 'onboarding' && onboardingData) {
      const od = onboardingData;
      const onboardingPrompt = `Você é o **Dotti** — assistente de onboarding.

## MISSÃO: Gere PLANO PERSONALIZADO DE 30 DIAS.

## DADOS DO USUÁRIO
- Tem canal: ${od.hasChannel ? 'Sim' : 'Não'}
${od.channelLink ? `- Canal: ${od.channelLink}` : ''}
${od.hoursPerDay ? `- Horas/dia: ${od.hoursPerDay}` : ''}
${od.languages ? `- Idiomas: ${od.languages}` : ''}
${od.niche ? `- Nicho: ${od.niche}` : ''}
${od.budget ? `- Orçamento: ${od.budget === 'low' ? 'Baixo' : od.budget === 'medium' ? 'Médio' : 'Alto'}` : ''}
${od.preference ? `- Preferência: ${od.preference === 'passion' ? 'Paixão' : od.preference === 'money' ? 'Monetização' : 'Ambos'}` : ''}

## DADOS REAIS
### Nichos:\n${nicheContext}
### Canais:\n${channelContext.slice(0, 3000)}
${usedSemantic ? `### RAG:\n${semanticContext.slice(0, 4000)}` : fallbackContext.slice(0, 4000)}

## FORMATO: Diagnóstico + Semana 1-4 detalhada + Projeção Financeira
## REGRAS: Honesto, dados reais, adapte às horas, português brasileiro`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: onboardingPrompt }, ...messages],
          stream: true,
        }),
      });
      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI error");
      }
      return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // ========== REGULAR CHAT MODE (with tools) ==========
    const knowledgeBlock = usedSemantic
      ? `## 🔍 CONHECIMENTO RAG (Semântico)\n${semanticContext}`
      : `## BASE DE CONHECIMENTO\n${fallbackContext}`;

    const systemPrompt = `Você é o **Dotti** — consultor estratégico de YouTube da plataforma Dotti com acesso a FERRAMENTAS REAIS.

## 🔧 SUAS FERRAMENTAS (USE ATIVAMENTE!)
Você tem acesso a ferramentas que executam ações REAIS na plataforma:
- **dubspy_search**: Pesquisar vídeos/canais no YouTube em tempo real
- **analyze_niche**: Analisar viabilidade de nicho com dados reais
- **analyze_channel**: Analisar canal do YouTube com métricas reais
- **reverse_engineer_video**: Fazer engenharia reversa de vídeo viral
- **find_outliers**: Encontrar vídeos outliers (canais pequenos com views altos)
- **generate_titles**: Gerar títulos virais otimizados
- **search_viral_database**: Buscar no banco de 900+ títulos virais
- **channel_intelligence_search**: Buscar no banco de 650+ canais analisados
- **estimate_revenue**: Estimar receita de canal/nicho

**REGRA CRÍTICA DE FERRAMENTAS**: Quando o usuário pedir pesquisa, análise de canal, análise de nicho, ou qualquer informação que suas ferramentas possam fornecer, USE A FERRAMENTA APROPRIADA em vez de responder com dados genéricos. Prefira dados em tempo real.

## SUA PERSONALIDADE
- **DISCORDA** quando a decisão é ruim
- **DESAFIA** escolhas que atrasam monetização  
- **SUGERE ALTERNATIVAS** proativamente
- É **DIRETO** e **HONESTO** como mentor de verdade
- Fala com **DADOS REAIS**, nunca opiniões vagas

## QUANDO USAR FERRAMENTAS (OBRIGATÓRIO):
1. Usuário menciona um canal → use analyze_channel
2. Usuário pergunta sobre nicho → use analyze_niche
3. Usuário quer encontrar canais/vídeos → use dubspy_search
4. Usuário compartilha URL de vídeo → use reverse_engineer_video
5. Usuário quer ideias de título → use generate_titles
6. Usuário quer exemplos de títulos virais → use search_viral_database
7. Usuário pergunta sobre ganhos → use estimate_revenue
8. Usuário quer encontrar oportunidades → use find_outliers
9. Usuário quer comparar canais → use channel_intelligence_search

## INTELIGÊNCIA DE MERCADO
### MAPA GLOBAL DE OPORTUNIDADES:
#### TIER S (RPM Alto + Zero Competição): Noruega $9-12, Suécia $8-11, Suíça $10-14, Dinamarca $8-10
#### TIER A: Holanda $7-9, Polônia $4-6, Tchéquia $3-5, Áustria $7-9
#### TIER B (Volume): Turquia $2-4 (85M pop), Indonésia $1-2 (270M), Vietnã $1-3, Tailândia $2-3

## CONTEXTO
${pageContext}
${userProfileContext}
${knowledgeBlock}

### 📺 Canais (${channelIntel.data?.length || 0}):\n${channelContext}
### 🔥 Títulos Virais (${viralTitles.data?.length || 0}):\n${viralContext}
### 📊 Nichos (${nicheDb.data?.length || 0}):\n${nicheContext}

## REGRAS:
1. Português brasileiro, tom de MENTOR
2. DISCORDA quando necessário
3. Dados REAIS — nunca invente
4. Sempre mencione RPM + competição por país
5. AÇÃO CONCRETA ao final: "Próximo passo: faz X agora"
6. USE FERRAMENTAS quando tiver dados em tempo real disponíveis
7. Após usar ferramenta, INTERPRETE os resultados para o usuário com insights estratégicos
8. ${usedSemantic ? 'RAG semântico ativo — priorize esses dados.' : 'RAG por score ativo.'}
9. Se tem dados do PERFIL DO USUÁRIO, personalize TODA resposta`;

    // First AI call with tools
    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];
    
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools: DOTTI_TOOLS,
        stream: false, // Non-streaming for tool detection
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (firstResponse.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, t);
      throw new Error("AI gateway error");
    }

    const firstResult = await firstResponse.json();
    const firstChoice = firstResult.choices?.[0]?.message;

    // Check if model wants to call tools
    if (firstChoice?.tool_calls?.length > 0) {
      console.log(`Dotti calling ${firstChoice.tool_calls.length} tools:`, firstChoice.tool_calls.map((t: any) => t.function.name));

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        firstChoice.tool_calls.map(async (tc: any) => {
          const args = JSON.parse(tc.function.arguments || '{}');
          console.log(`Executing tool: ${tc.function.name}`, args);
          const result = await executeTool(tc.function.name, args, sb, supabaseUrl, supabaseKey);
          return {
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          };
        })
      );

      // Second AI call with tool results — STREAMING
      const secondMessages = [
        ...aiMessages,
        firstChoice, // The assistant message with tool_calls
        ...toolResults,
      ];

      const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: secondMessages,
          stream: true,
        }),
      });

      if (!secondResponse.ok) {
        const t = await secondResponse.text();
        console.error("Second AI call error:", secondResponse.status, t);
        throw new Error("AI gateway error on tool response");
      }

      return new Response(secondResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tools called — stream the direct response
    // Re-do the call with streaming since firstResponse was non-streaming
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) throw new Error("Stream error");

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
