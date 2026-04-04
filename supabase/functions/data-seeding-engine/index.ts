import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── AI Analysis via Lovable Gateway ──
async function aiAnalyze(prompt: string, apiKey: string, toolDef?: any): Promise<any> {
  const body: any = {
    model: "google/gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: "You are a YouTube content analyst. Always respond via the tool call. Be precise with numbers." },
      { role: "user", content: prompt.slice(0, 6000) },
    ],
  };
  if (toolDef) {
    body.tools = [toolDef];
    body.tool_choice = { type: "function", function: { name: toolDef.function.name } };
  }

  const resp = await _ai(body);

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI ${resp.status}: ${t.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (toolDef) {
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No tool call");
    return JSON.parse(tc.function.arguments);
  }
  return data.choices?.[0]?.message?.content || "";
}

// ── Tool schemas ──
const CONTENT_DNA_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_content_dna",
    description: "Extract viral DNA from a video",
    parameters: {
      type: "object",
      properties: {
        hook_type: { type: "string", enum: ["question", "statement", "story", "statistic", "challenge", "controversy", "mystery", "pov"] },
        hook_pattern: { type: "string" },
        hook_strength: { type: "number", minimum: 0, maximum: 10 },
        title_structure: { type: "string", enum: ["listicle", "how-to", "story", "challenge", "vs", "reaction", "mystery", "emotional"] },
        title_uses_numbers: { type: "boolean" },
        title_uses_questions: { type: "boolean" },
        title_emotion: { type: "string" },
        story_structure: { type: "string", enum: ["hero_journey", "problem_solution", "chronological", "mystery_reveal", "escalation", "comparison", "tutorial"] },
        pacing: { type: "string", enum: ["fast", "medium", "slow", "variable"] },
        cliffhanger_count: { type: "integer", minimum: 0 },
        open_loop_count: { type: "integer", minimum: 0 },
        visual_style: { type: "string" },
        thumbnail_pattern: { type: "string" },
        emotion_primary: { type: "string" },
        emotion_secondary: { type: "string" },
        psychological_triggers: { type: "array", items: { type: "string" } },
        attention_score: { type: "number", minimum: 0, maximum: 100 },
        curiosity_score: { type: "number", minimum: 0, maximum: 100 },
        dopamine_score: { type: "number", minimum: 0, maximum: 100 },
        estimated_retention: { type: "number", minimum: 0, maximum: 100 },
        why_viral: { type: "string" },
        replication_template: { type: "string" },
        content_model: { type: "string" },
        gold_score: { type: "number", minimum: 0, maximum: 100 },
        viral_score: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["hook_type", "hook_strength", "title_structure", "story_structure", "pacing", "emotion_primary", "psychological_triggers", "attention_score", "curiosity_score", "dopamine_score", "estimated_retention", "why_viral", "viral_score"],
      additionalProperties: false,
    },
  },
};

const VIRAL_PATTERN_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_viral_patterns",
    description: "Extract recurring viral patterns from a set of videos in a niche",
    parameters: {
      type: "object",
      properties: {
        patterns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pattern_name: { type: "string" },
              pattern_json: {
                type: "object",
                properties: {
                  hook_types: { type: "array", items: { type: "string" } },
                  emotional_triggers: { type: "array", items: { type: "string" } },
                  title_formulas: { type: "array", items: { type: "string" } },
                  pacing: { type: "string" },
                  avg_retention: { type: "number" },
                  content_models: { type: "array", items: { type: "string" } },
                  success_factor: { type: "string" },
                },
                required: ["hook_types", "emotional_triggers", "title_formulas", "success_factor"],
                additionalProperties: false,
              },
            },
            required: ["pattern_name", "pattern_json"],
            additionalProperties: false,
          },
        },
      },
      required: ["patterns"],
      additionalProperties: false,
    },
  },
};

// ── Embedding generator ──
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const resp = await _ai({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Output ONLY a JSON array of exactly 768 floats between -1 and 1 representing the semantic meaning. No explanation." },
        { role: "user", content: text.slice(0, 2000) },
      ],
      tools: [{
        type: "function",
        function: {
          name: "store_embedding",
          description: "Store embedding vector",
          parameters: {
            type: "object",
            properties: { embedding: { type: "array", items: { type: "number" } } },
            required: ["embedding"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "store_embedding" } },
    });

  if (!resp.ok) throw new Error(`Embedding ${resp.status}`);
  const data = await resp.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No embedding tool call");
  let emb = JSON.parse(tc.function.arguments).embedding;
  if (!Array.isArray(emb)) throw new Error("Bad embedding");
  while (emb.length < 768) emb.push(0);
  if (emb.length > 768) emb = emb.slice(0, 768);
  const mag = Math.sqrt(emb.reduce((s: number, v: number) => s + v * v, 0));
  if (mag > 0) emb = emb.map((v: number) => v / mag);
  return emb;
}

// ── PHASE 1: Content DNA from channel_intelligence ──
async function phase1ContentDNA(sb: any, apiKey: string, limit: number) {
  const { data: channels } = await sb
    .from("channel_intelligence")
    .select("youtube_channel_id, channel_name, niche, language, subscribers, avg_views, style, top_videos, viral_patterns")
    .limit(limit);

  if (!channels?.length) return { processed: 0, errors: 0 };

  let processed = 0, errors = 0;

  for (const ch of channels) {
    const videos = Array.isArray(ch.top_videos) ? ch.top_videos : [];
    if (!videos.length) continue;

    for (const video of videos.slice(0, 3)) {
      const videoId = video.video_id || `${ch.youtube_channel_id}_${video.title?.slice(0, 20)?.replace(/\s/g, '_') || processed}`;

      // Check if already exists
      const { data: existing } = await sb.from("content_dna").select("id").eq("video_id", videoId).maybeSingle();
      if (existing) continue;

      try {
        const prompt = `Analyze this viral YouTube video's DNA:
Title: "${video.title}"
Views: ${video.views?.toLocaleString() || 'unknown'}
Channel: ${ch.channel_name} (${ch.subscribers?.toLocaleString()} subs)
Niche: ${ch.niche}
Language: ${ch.language}
Hook text: "${video.hook_text || 'N/A'}"
Channel style: ${ch.style}

Based on this data, extract the complete content DNA. Consider why this video went viral relative to the channel size.`;

        const dna = await aiAnalyze(prompt, apiKey, CONTENT_DNA_TOOL);
        const multiplier = (ch.avg_views && ch.avg_views > 0) ? Math.round((video.views || 0) / ch.avg_views * 100) / 100 : null;

        await sb.from("content_dna").upsert({
          video_id: videoId,
          video_title: video.title || "Unknown",
          channel_id: ch.youtube_channel_id,
          channel_name: ch.channel_name,
          niche: ch.niche,
          language: ch.language,
          views: video.views || 0,
          subscribers: ch.subscribers,
          multiplier,
          hook_type: dna.hook_type,
          hook_pattern: dna.hook_pattern || video.hook_text,
          hook_strength: dna.hook_strength,
          title_structure: dna.title_structure,
          title_uses_numbers: dna.title_uses_numbers || false,
          title_uses_questions: dna.title_uses_questions || false,
          title_emotion: dna.title_emotion,
          story_structure: dna.story_structure,
          pacing: dna.pacing,
          cliffhanger_count: dna.cliffhanger_count || 0,
          open_loop_count: dna.open_loop_count || 0,
          visual_style: dna.visual_style || ch.style,
          thumbnail_pattern: dna.thumbnail_pattern,
          emotion_primary: dna.emotion_primary,
          emotion_secondary: dna.emotion_secondary,
          psychological_triggers: dna.psychological_triggers || [],
          attention_score: dna.attention_score,
          curiosity_score: dna.curiosity_score,
          dopamine_score: dna.dopamine_score,
          estimated_retention: dna.estimated_retention,
          why_viral: dna.why_viral,
          replication_template: dna.replication_template,
          content_model: dna.content_model,
          gold_score: dna.gold_score || dna.viral_score,
          viral_score: dna.viral_score,
          source: "data-seeding-engine",
          video_type: "long",
        }, { onConflict: "video_id" });

        processed++;
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`DNA error ${ch.channel_name}/${video.title}:`, e);
        errors++;
      }
    }
  }

  return { processed, errors };
}

// ── PHASE 2: Viral Patterns by Niche ──
async function phase2ViralPatterns(sb: any, apiKey: string) {
  // Group channels by niche
  const { data: niches } = await sb
    .from("channel_intelligence")
    .select("niche, channel_name, top_videos, style, viral_patterns")
    .order("niche");

  if (!niches?.length) return { processed: 0, errors: 0 };

  const nicheMap: Record<string, any[]> = {};
  for (const ch of niches) {
    if (!nicheMap[ch.niche]) nicheMap[ch.niche] = [];
    nicheMap[ch.niche].push(ch);
  }

  let processed = 0, errors = 0;

  for (const [niche, channels] of Object.entries(nicheMap)) {
    // Check if patterns already exist for this niche
    const { data: existing } = await sb.from("viral_patterns").select("id").eq("niche", niche).limit(1);
    if (existing?.length) continue;

    try {
      const topVideos = channels
        .flatMap((c: any) => {
          const vids = Array.isArray(c.top_videos) ? c.top_videos : [];
          return vids.map((v: any) => ({ ...v, channel: c.channel_name, style: c.style }));
        })
        .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
        .slice(0, 15);

      if (topVideos.length < 3) continue;

      const prompt = `Analyze these ${topVideos.length} top viral videos in the "${niche}" niche and identify 3-5 recurring viral patterns:

${topVideos.map((v: any, i: number) => `${i + 1}. "${v.title}" (${v.views?.toLocaleString()} views) by ${v.channel} — hook: "${v.hook_text || 'N/A'}" — style: ${v.style}`).join('\n')}

Find the common patterns that make videos go viral in this niche. Focus on hook types, emotional triggers, title formulas, pacing, and content models.`;

      const result = await aiAnalyze(prompt, apiKey, VIRAL_PATTERN_TOOL);

      for (const p of (result.patterns || [])) {
        await sb.from("viral_patterns").insert({
          pattern_name: p.pattern_name,
          pattern_json: p.pattern_json,
          niche,
          source_video: topVideos[0]?.title || niche,
        });
        processed++;
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`Pattern error niche=${niche}:`, e);
      errors++;
    }
  }

  return { processed, errors };
}

// ── PHASE 3: Score Calibration ──
async function phase3ScoreCalibration(sb: any) {
  // Build calibration from content_dna aggregations
  const { data: dnaRows } = await sb
    .from("content_dna")
    .select("niche, viral_score, attention_score, curiosity_score, dopamine_score, estimated_retention, views, multiplier")
    .not("niche", "is", null);

  if (!dnaRows?.length) return { processed: 0 };

  const nicheStats: Record<string, { scores: number[]; retentions: number[]; views: number[]; count: number }> = {};

  for (const row of dnaRows) {
    const n = row.niche || "general";
    if (!nicheStats[n]) nicheStats[n] = { scores: [], retentions: [], views: [], count: 0 };
    nicheStats[n].scores.push(row.viral_score || 0);
    nicheStats[n].retentions.push(row.estimated_retention || 0);
    nicheStats[n].views.push(row.views || 0);
    nicheStats[n].count++;
  }

  let processed = 0;

  const scoreTypes = ["viral_score", "retention_score", "attention_score", "hook_strength"];

  for (const [niche, stats] of Object.entries(nicheStats)) {
    if (stats.count < 2) continue;

    for (const scoreType of scoreTypes) {
      const avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.count;
      const avgViews = stats.views.reduce((a, b) => a + b, 0) / stats.count;

      // Calculate bias: if avg predicted score is very different from actual performance
      const biasCorrectionFactor = avgViews > 1000000 ? 0.1 : avgViews > 100000 ? 0.05 : -0.05;

      await sb.from("score_calibration").upsert({
        score_type: scoreType,
        niche,
        weight_adjustment: 1.0 + biasCorrectionFactor,
        bias_correction: biasCorrectionFactor,
        confidence: Math.min(stats.count / 20, 1.0),
        samples_count: stats.count,
        avg_error: Math.abs(avgScore - 70) / 100, // deviation from "ideal" baseline
        last_calibrated_at: new Date().toISOString(),
        metadata: { avg_views: avgViews, avg_score: avgScore },
      }, { onConflict: "score_type,niche" });

      processed++;
    }
  }

  return { processed };
}

// ── PHASE 4: Embeddings for all knowledge bases ──
async function phase4Embeddings(sb: any, apiKey: string, batchLimit: number) {
  const SOURCES = [
    {
      table: "content_dna",
      select: "id, video_title, channel_name, niche, hook_pattern, why_viral, emotion_primary, story_structure, viral_score",
      textBuilder: (r: any) => `[Viral DNA] "${r.video_title}" by ${r.channel_name} (${r.niche}): hook="${r.hook_pattern}", estrutura=${r.story_structure}, emoção=${r.emotion_primary}, viral=${r.viral_score}/100. ${r.why_viral || ''}`,
      metaBuilder: (r: any) => ({ niche: r.niche, viral_score: r.viral_score }),
      limit: batchLimit,
    },
    {
      table: "viral_patterns",
      select: "id, pattern_name, niche, pattern_json",
      textBuilder: (r: any) => `[Padrão Viral ${r.niche}] ${r.pattern_name}: ${JSON.stringify(r.pattern_json).slice(0, 500)}`,
      metaBuilder: (r: any) => ({ niche: r.niche }),
      limit: 200,
    },
    {
      table: "channel_intelligence",
      select: "id, channel_name, niche, language, subscribers, avg_views, style, growth_rate, is_faceless",
      textBuilder: (r: any) => `[Canal] ${r.channel_name}: nicho=${r.niche}, ${r.subscribers} subs, ${r.avg_views} views avg, estilo=${r.style}, crescimento=${r.growth_rate}, faceless=${r.is_faceless}, idioma=${r.language}`,
      metaBuilder: (r: any) => ({ niche: r.niche, subs: r.subscribers }),
      limit: batchLimit,
    },
  ];

  let totalProcessed = 0, totalErrors = 0;

  for (const source of SOURCES) {
    const { data: rows } = await sb.from(source.table).select(source.select).limit(source.limit);
    if (!rows?.length) continue;

    // Check existing
    const { data: existing } = await sb
      .from("knowledge_embeddings")
      .select("source_id")
      .eq("source_table", source.table);

    const existingIds = new Set((existing || []).map((e: any) => e.source_id));
    const newRows = rows.filter((r: any) => !existingIds.has(r.id));

    console.log(`Embeddings ${source.table}: ${newRows.length} new / ${rows.length} total`);

    for (const row of newRows) {
      try {
        const text = source.textBuilder(row);
        const embedding = await generateEmbedding(text, apiKey);
        const embStr = `[${embedding.join(",")}]`;

        await sb.from("knowledge_embeddings").upsert({
          source_table: source.table,
          source_id: row.id,
          content_text: text.slice(0, 5000),
          metadata: source.metaBuilder(row),
          embedding: embStr,
        }, { onConflict: "source_table,source_id" });

        totalProcessed++;
        await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        console.error(`Embedding error ${source.table}/${row.id}:`, e);
        totalErrors++;
      }
    }
  }

  return { processed: totalProcessed, errors: totalErrors };
}

// ── Main Handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phase, channelLimit = 50, embeddingLimit = 100 } = await req.json().catch(() => ({}));
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const report: Record<string, any> = {};

    // Run specific phase or all phases
    const phases = phase ? [phase] : ["content_dna", "viral_patterns", "score_calibration", "embeddings"];

    for (const p of phases) {
      console.log(`=== Starting phase: ${p} ===`);
      const start = Date.now();

      switch (p) {
        case "content_dna":
          report.content_dna = await phase1ContentDNA(sb, GOOGLE_AI_API_KEY, channelLimit);
          break;
        case "viral_patterns":
          report.viral_patterns = await phase2ViralPatterns(sb, GOOGLE_AI_API_KEY);
          break;
        case "score_calibration":
          report.score_calibration = await phase3ScoreCalibration(sb);
          break;
        case "embeddings":
          report.embeddings = await phase4Embeddings(sb, GOOGLE_AI_API_KEY, embeddingLimit);
          break;
      }

      report[p] = { ...report[p], duration_ms: Date.now() - start };
      console.log(`=== Phase ${p} done in ${Date.now() - start}ms ===`, report[p]);
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "data-seeding-engine",
      success: true,
      metadata: report,
      duration_ms: Object.values(report).reduce((s: number, r: any) => s + (r.duration_ms || 0), 0),
    });

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("data-seeding-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
