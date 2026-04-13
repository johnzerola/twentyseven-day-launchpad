import { callGeminiOpenAICompat, generateEmbedding } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TUBEBOT_TOOLS } from "../_shared/tubebot-tools.ts";
import { executeTool } from "../_shared/tubebot-executor.ts";
import { buildSystemPrompt, buildOnboardingPrompt } from "../_shared/tubebot-system-prompt.ts";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  return await callGeminiOpenAICompat(apiKey, body);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const currentUserId = userData.user.id;

    const { messages, currentPage, mode, onboardingData, conversationId } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // ═══ TUBEBOT DAILY LIMIT CHECK ═══
    const { data: limitCheck } = await sb.rpc("check_tubebot_limit", { _user_id: currentUserId });
    if (limitCheck && !limitCheck.allowed) {
      return new Response(JSON.stringify({
        error: `Limite diário do TubeBot atingido (${limitCheck.used}/${limitCheck.limit}). Faça upgrade para mais mensagens.`,
        limit_reached: true,
        used: limitCheck.used,
        daily_limit: limitCheck.limit,
        tier: limitCheck.tier,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ CONVERSATION MEMORY ═══
    let conversationMemoryBlock = '';
    try {
      const { data: pastSummaries } = await sb.from("ai_learning")
        .select("topic, insight, created_at")
        .eq("source", "conversation_summary")
        .order("created_at", { ascending: false }).limit(3);
      if (pastSummaries?.length) {
        conversationMemoryBlock = `\n## 🧠 MEMÓRIA (${pastSummaries.length} sessões):\n` +
          pastSummaries.map((s: any) => {
            try {
              const data = JSON.parse(s.insight);
              return `- **${data.topic || s.topic}** (${new Date(s.created_at).toLocaleDateString('pt-BR')}): ${data.summary || ''}`;
            } catch { return `- ${s.topic}: ${(s.insight || '').slice(0, 200)}`; }
          }).join('\n');
      }
    } catch (e) { console.warn("Memory fetch error:", e); }

    // ═══ ACTIVE SCRIPT CONTEXT ═══
    let activeScriptBlock = '';
    if (currentPage === '/scripts') {
      try {
        const { data: recentScript } = await sb.from("saved_scripts" as any)
          .select("topic, style, niche, hook_text, script_text, created_at")
          .eq("user_id", currentUserId)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (recentScript) {
          const rs = recentScript as any;
          activeScriptBlock = `\n## ✍️ ROTEIRO EM EDIÇÃO:\n- Tópico: ${rs.topic || '?'}\n- Estilo: ${rs.style || '?'}\n- Hook: ${(rs.hook_text || '').slice(0, 200)}\n- Preview: ${(rs.script_text || '').slice(0, 500)}`;
        }
      } catch (e) { console.warn("Script fetch error:", e); }
    }

    // ═══ SAVE CONVERSATION SUMMARY ═══
    if (conversationId && messages?.length >= 10) {
      try {
        const userMsgs = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' | ');
        const summaryKey = `conv_summary:${conversationId}`;
        const { data: existing } = await sb.from("ai_learning").select("id").eq("topic", summaryKey).eq("source", "conversation_summary").maybeSingle();
        if (!existing) {
          await sb.from("ai_learning").insert({
            topic: summaryKey, source: "conversation_summary",
            insight: JSON.stringify({ topic: userMsgs.slice(0, 100), summary: userMsgs.slice(0, 500), message_count: messages.length, page: currentPage, timestamp: new Date().toISOString() }),
          });
        }
      } catch (e) { console.warn("Summary save error:", e); }
    }

    // ═══ USER PROFILE CONTEXT ═══
    let userProfileContext = '';
    const [userChannels, savedSearches, savedScripts, savedTitles, outliers, onboardingPlan, plannerCards, trackedChannels, videoPerf, scriptPrefs] = await Promise.all([
      sb.from("user_channels").select("channel_name, niche, subscribers, views, videos, youtube_channel_id, analysis_json").eq("user_id", currentUserId).limit(10),
      sb.from("saved_searches").select("query, tab, notes, filters_json, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(15),
      sb.from("saved_scripts").select("topic, style, video_type, duration, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(10),
      sb.from("saved_titles").select("topic, niche, titles_json, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(10),
      sb.from("outlier_channels").select("video_title, channel_name, views, multiplier, niche").eq("user_id", currentUserId).order("found_at", { ascending: false }).limit(10),
      sb.from("onboarding_plans").select("niche, goal, language, content_type, time_per_day, plan_json").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(1),
      sb.from("planner_cards").select("title, column_id, priority, tags").eq("user_id", currentUserId).order("updated_at", { ascending: false }).limit(15),
      sb.from("tracked_channels").select("channel_name, youtube_channel_id, subscribers, folder").eq("user_id", currentUserId).limit(20),
      sb.from("video_performance").select("title, views_current, views_day1, views_day3, views_day7, avg_retention_percent, ctr_percent, hook_type, niche, performance_grade, published_at").eq("user_id", currentUserId).order("published_at", { ascending: false }).limit(15),
      sb.from("user_script_preferences").select("niche, preferred_pov, preferred_duration_min, preferred_hook_styles, avg_retention, total_scripts, insights_json").eq("user_id", currentUserId).limit(5),
    ]);

    const blocks: string[] = [];
    if (userChannels.data?.length) {
      blocks.push(`### 📺 Canais (${userChannels.data.length}):\n` +
        userChannels.data.map(c => `- **${c.channel_name}** (${c.niche || '?'}): ${(c.subscribers || 0)/1000}K subs, ${(c.views || 0)/1000}K views`).join('\n'));
    }
    if (trackedChannels.data?.length) blocks.push(`### 🎯 Tracking (${trackedChannels.data.length}):\n` + trackedChannels.data.map((c: any) => `- ${c.channel_name} (${c.folder || 'geral'})`).join('\n'));
    if (videoPerf.data?.length) {
      blocks.push(`### 📊 Performance Real (${videoPerf.data.length}):\n` +
        videoPerf.data.map((v: any) => `- "${v.title}": ${v.views_current} views, CTR ${v.ctr_percent}%, Retenção ${v.avg_retention_percent}%, Grade ${v.performance_grade}`).join('\n'));
    }
    if (savedScripts.data?.length) blocks.push(`### ✍️ Roteiros (${savedScripts.data.length}):\n` + savedScripts.data.map((s: any) => `- ${s.topic} (${s.style}, ${s.video_type})`).join('\n'));
    if (savedTitles.data?.length) blocks.push(`### 📝 Títulos (${savedTitles.data.length}):\n` + savedTitles.data.map((t: any) => `- ${t.topic} (${t.niche})`).join('\n'));
    if (outliers.data?.length) blocks.push(`### 💎 Outliers (${outliers.data.length}):\n` + outliers.data.map((o: any) => `- "${o.video_title}" — ${o.views} views, ${o.multiplier}x, ${o.channel_name}`).join('\n'));
    if (onboardingPlan.data?.length) {
      const p = onboardingPlan.data[0] as any;
      blocks.push(`### 🎯 Plano: ${p.niche} | ${p.goal} | ${p.time_per_day}h/dia`);
    }
    if (plannerCards.data?.length) blocks.push(`### 📋 Planner (${plannerCards.data.length}):\n` + plannerCards.data.map((c: any) => `- [${c.column_id}] ${c.title}`).join('\n'));
    if (scriptPrefs.data?.length) {
      blocks.push(`### 🎨 Preferências:\n` + scriptPrefs.data.map((p: any) => `- ${p.niche}: POV ${p.preferred_pov}, ${p.preferred_duration_min}min, hooks: ${(p.preferred_hook_styles || []).join('/')}, retenção: ${p.avg_retention}%`).join('\n'));
    }
    if (blocks.length) userProfileContext = `\n## 👤 PERFIL DO USUÁRIO\n${blocks.join('\n\n')}`;

    // ═══ Channel Voice Profile ═══
    let voiceProfileBlock = '';
    try {
      const { data: voiceProfile } = await sb.from("channel_voice_profiles").select("*").eq("user_id", currentUserId).limit(1).maybeSingle();
      if (voiceProfile) {
        const vp = voiceProfile as any;
        voiceProfileBlock = `\n## 🎤 DNA DO CANAL:\n- Tom: ${(vp.tone_keywords || []).join(', ')}\n- Hooks: ${(vp.common_hooks || []).join(' | ')}\n- Estrutura: ${vp.story_structure || '?'}\n- Duração ideal: ${vp.average_video_length || '?'}min`;
      }
    } catch { /* ignore */ }

    // ═══ Script Memory ═══
    let scriptMemoryBlock = '';
    try {
      const { data: memory } = await sb.from("user_script_memory" as any).select("*").eq("user_id", currentUserId).maybeSingle();
      if (memory) {
        const m = memory as any;
        scriptMemoryBlock = `\n## 🧠 MEMÓRIA DE ROTEIROS:\n- Scripts: ${m.total_scripts_generated}\n- Publicados: ${m.total_scripts_published}\n- Views: ${m.total_views_accumulated?.toLocaleString() || '0'}\n- Melhor estilo: ${m.best_performing_style}\n- Tópicos usados: ${(m.last_topics_used || []).slice(0, 10).join(', ')}`;
      }
    } catch { /* ignore */ }

    // ═══ SEMANTIC SEARCH ═══
    const userMessages = (messages || []).filter((m: any) => m.role === 'user');
    const latestQuery = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
    const recentContext = userMessages.slice(-3).map((m: any) => m.content).join(' ');

    let semanticContext = '';
    let usedSemantic = false;

    const queryEmbedding = await generateEmbedding(GOOGLE_AI_API_KEY, recentContext || latestQuery);
    if (queryEmbedding) {
      const { data: matches, error: matchError } = await sb.rpc('match_knowledge', {
        query_embedding: `[${queryEmbedding.join(',')}]`, match_count: 30, match_threshold: 0.40,
      });
      if (!matchError && matches?.length > 0) {
        usedSemantic = true;
        const grouped: Record<string, any[]> = {};
        for (const m of matches) {
          if (!grouped[m.source_table]) grouped[m.source_table] = [];
          grouped[m.source_table].push(m);
        }
        const tableLabels: Record<string, string> = {
          youtube_knowledge: '📚 Algoritmo', script_knowledge: '✍️ Roteiro',
          hook_library: '🎣 Hooks', audience_psychology_patterns: '🧬 Psicologia',
          attention_engineering: '⚡ Atenção', content_models: '🎬 Modelos',
          script_structures: '📐 Estruturas', hook_patterns: '🧠 Padrões',
          scene_prompt_knowledge: '🎥 Prompts', niche_database: '📊 Nichos',
          viral_titles_db: '🔥 Virais', attention_library: '👁️ Atenção',
        };
        const contextBlocks: string[] = [];
        for (const [table, items] of Object.entries(grouped)) {
          const label = tableLabels[table] || table;
          const block = items.sort((a, b) => b.similarity - a.similarity).map(m => `  [${(m.similarity * 100).toFixed(0)}%] ${m.content_text.slice(0, 300)}`).join('\n');
          contextBlocks.push(`### ${label} (${items.length}):\n${block}`);
        }
        semanticContext = contextBlocks.join('\n\n');
      }
    }

    // ═══ ESSENTIAL DATA ═══
    const [channelIntel, viralTitles, nicheDb] = await Promise.all([
      sb.from("channel_intelligence").select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country, language, upload_frequency").limit(40),
      sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern, channel_name, country, language, why_viral").order("views", { ascending: false }).limit(30),
      sb.from("niche_database").select("name, rpm_estimate, difficulty, saturation, faceless_friendly, country, language, sub_niches").limit(60),
    ]);

    const channelContext = (channelIntel.data || []).map(c =>
      `${c.channel_name} (${c.niche}): ${(c.avg_views/1000).toFixed(0)}K views, ${(c.subscribers/1000).toFixed(0)}K subs, RPM $${c.rpm_estimate}, ${c.growth_rate}, ${c.is_faceless ? 'faceless' : 'facecam'}, ${c.country}`
    ).join('\n');
    const viralContext = (viralTitles.data || []).map(v =>
      `"${v.title}" — ${(v.views/1000).toFixed(0)}K views, ${v.niche}, triggers: ${(v.emotional_triggers || []).join(', ')}`
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
### 📚 Algoritmo:\n${(ytK.data || []).map(k => `[${k.category}] ${k.title}: ${k.content.slice(0, 400)}`).join('\n')}
### ✍️ Roteiro:\n${(scriptK.data || []).map(k => `${k.title}: ${k.content.slice(0, 300)}`).join('\n')}
### 🎣 Hooks:\n${(hookL.data || []).map(h => `[${h.hook_type}] "${h.hook_text}" — ${h.retention_score}/10`).join('\n')}
### ⚡ Atenção:\n${(attE.data || []).map(a => `${a.pattern_name}: ${a.technique} | ${a.retention_impact}%`).join('\n')}
### 🧬 Psicologia:\n${(audP.data || []).map(p => `[${p.trigger_type}] ${p.description.slice(0, 200)}`).join('\n')}
### 🎬 Modelos:\n${(contM.data || []).map(m => `${m.model_name} (${m.video_type}): ${m.description.slice(0, 150)}`).join('\n')}
### 📐 Estruturas:\n${(scriptS.data || []).map(s => `${s.structure_name}: ${s.avg_retention}%`).join('\n')}
### 🧠 Hook Patterns:\n${(hookP.data || []).map(h => `${h.pattern_name}: "${h.template}" +${h.avg_retention_boost}%`).join('\n')}`;
    }

    const knowledgeBlock = usedSemantic
      ? `## 🔍 CONHECIMENTO RAG\n${semanticContext}`
      : `## BASE DE CONHECIMENTO\n${fallbackContext}`;

    // ═══ ONBOARDING MODE ═══
    if (mode === 'onboarding' && onboardingData) {
      const systemPrompt = buildOnboardingPrompt({
        onboardingData,
        nicheContext,
        channelContext,
        knowledgeContext: usedSemantic ? `### RAG:\n${semanticContext.slice(0, 4000)}` : fallbackContext.slice(0, 4000),
      });
      const response = await _ai({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      });
      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI error");
      }
      return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // ═══ REGULAR CHAT MODE ═══
    const systemPrompt = buildSystemPrompt({
      currentPage, conversationMemoryBlock, activeScriptBlock,
      userProfileContext: userProfileContext + voiceProfileBlock + scriptMemoryBlock,
      knowledgeBlock, channelContext, viralContext, nicheContext,
      usedSemantic, channelCount: channelIntel.data?.length || 0,
      viralCount: viralTitles.data?.length || 0, nicheCount: nicheDb.data?.length || 0,
    });

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // First call with tools (fast model for tool selection)
    const firstResponse = await _ai({
      model: "google/gemini-2.5-flash-lite",
      messages: aiMessages,
      tools: TUBEBOT_TOOLS,
      stream: false,
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (firstResponse.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await firstResponse.text();
      console.error("AI error:", firstResponse.status, t);
      throw new Error("AI gateway error");
    }

    const firstResult = await firstResponse.json();
    const firstChoice = firstResult.choices?.[0]?.message;

    // Direct answer (no tools)
    if (!firstChoice?.tool_calls?.length && firstChoice?.content) {
      const streamResponse = await _ai({ model: "google/gemini-2.5-flash", messages: aiMessages, stream: true });
      if (!streamResponse.ok) throw new Error("Stream error");
      return new Response(streamResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // ═══ MULTI-ROUND TOOL EXECUTION ═══
    let currentMessages = [...aiMessages];
    let currentChoice = firstChoice;
    let toolRound = 0;
    const MAX_TOOL_ROUNDS = 3;
    const MAX_PARALLEL_TOOLS = 5;

    while (currentChoice?.tool_calls?.length > 0 && toolRound < MAX_TOOL_ROUNDS) {
      toolRound++;
      const toolCalls = currentChoice.tool_calls.slice(0, MAX_PARALLEL_TOOLS);
      console.log(`TubeBot round ${toolRound}: ${toolCalls.length} tools:`, toolCalls.map((t: any) => t.function.name));

      const toolResults = await Promise.all(
        toolCalls.map(async (tc: any) => {
          let parsedArgs: any = {};
          try { parsedArgs = JSON.parse(tc.function.arguments || '{}'); } catch {
            return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: `Invalid args for ${tc.function.name}` }) };
          }
          const result = await executeTool(tc.function.name, parsedArgs, sb, supabaseUrl, supabaseKey);
          return { role: "tool", tool_call_id: tc.id, content: result };
        })
      );

      currentMessages = [...currentMessages, currentChoice, ...toolResults];

      if (toolRound < MAX_TOOL_ROUNDS) {
        const nextResponse = await _ai({ model: "google/gemini-2.5-flash", messages: currentMessages, tools: TUBEBOT_TOOLS, stream: false });
        if (!nextResponse.ok) { console.error("Multi-round failed:", nextResponse.status); break; }
        const nextResult = await nextResponse.json();
        currentChoice = nextResult.choices?.[0]?.message;
        if (!currentChoice?.tool_calls?.length) {
          const finalStream = await _ai({ model: "google/gemini-2.5-flash", messages: currentMessages, stream: true });
          if (!finalStream.ok) throw new Error("Final stream error");
          return new Response(finalStream.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
      }
    }

    // Final streaming response after tools
    if (toolRound > 0) {
      const finalResponse = await _ai({ model: "google/gemini-2.5-flash", messages: currentMessages, stream: true });
      if (!finalResponse.ok) throw new Error("Final stream error");
      return new Response(finalResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Fallback: stream direct
    const streamResponse = await _ai({ model: "google/gemini-2.5-flash", messages: aiMessages, stream: true });
    if (!streamResponse.ok) throw new Error("Stream error");
    return new Response(streamResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
