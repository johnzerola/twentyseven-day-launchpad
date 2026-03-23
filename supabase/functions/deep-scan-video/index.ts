import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyVeo3PolicyFilter, VEO3_POLICY_PROMPT } from "../_shared/veo3-policy-filter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function parseDuration(iso: string): number {
  const d = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return d ? (parseInt(d[1]||'0')*3600 + parseInt(d[2]||'0')*60 + parseInt(d[3]||'0')) : 0;
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function extractTranscript(xml: string): string {
  const textMatches = xml.match(/<text[^>]*>(.*?)<\/text>/gs);
  if (!textMatches) return "";
  return textMatches
    .map(m => m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
    .join(' ')
    .slice(0, 4000);
}

function extractTimedTranscript(xml: string): { text: string; start: number; dur: number }[] {
  const matches = xml.match(/<text start="([^"]+)" dur="([^"]+)"[^>]*>(.*?)<\/text>/gs);
  if (!matches) return [];
  return matches.map(m => {
    const startMatch = m.match(/start="([^"]+)"/);
    const durMatch = m.match(/dur="([^"]+)"/);
    const text = m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    return {
      text,
      start: parseFloat(startMatch?.[1] || '0'),
      dur: parseFloat(durMatch?.[1] || '0'),
    };
  });
}

async function fetchTranscriptRaw(videoId: string): Promise<string> {
  for (const lang of ['pt', 'en', 'es', 'de', 'pl']) {
    try {
      const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`);
      if (res.ok) {
        const xml = await res.text();
        if (xml.includes('<text')) return xml;
      } else {
        await res.text();
      }
    } catch { /* continue */ }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { videoId } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!videoId) throw new Error("videoId is required");

    // 1. Fetch video + channel details + transcript in parallel
    const [vRes, transcriptXml] = await Promise.all([
      fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,topicDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`),
      fetchTranscriptRaw(videoId),
    ]);

    const vData = await vRes.json();
    const video = vData.items?.[0];
    if (!video) throw new Error("Vídeo não encontrado");
    
    const transcript = extractTranscript(transcriptXml);
    const timedTranscript = extractTimedTranscript(transcriptXml);

    // 2. Fetch channel details
    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${video.snippet.channelId}&key=${YOUTUBE_API_KEY}`);
    const chData = await chRes.json();
    const channel = chData.items?.[0];
    const channelSubs = parseInt(channel?.statistics?.subscriberCount || '0');
    const channelAvgViews = parseInt(channel?.statistics?.viewCount || '0') / Math.max(parseInt(channel?.statistics?.videoCount || '1'), 1);

    const views = parseInt(video.statistics.viewCount || '0');
    const likes = parseInt(video.statistics.likeCount || '0');
    const comments = parseInt(video.statistics.commentCount || '0');
    const outlierScore = channelAvgViews > 0 ? (views / channelAvgViews).toFixed(1) : 'N/A';
    const durationSeconds = parseDuration(video.contentDetails.duration);
    const durationMinutes = Math.round(durationSeconds / 60);

    // ═══ CAPTURE VIDEO FRAMES ═══
    // Limit to 2 frames to reduce payload size and prevent timeouts
    const thumbnailUrl = video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || '';
    // Use only thumbnail to minimize payload and prevent timeouts
    const frameUrls = [thumbnailUrl].filter(Boolean);

    const frameChecks = await Promise.allSettled(
      frameUrls.map(async (url) => {
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok ? url : null;
      })
    );
    const validFrames = frameChecks
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean) as string[];
    
    console.log(`Captured ${validFrames.length} frames for analysis`);

    // ═══ BUILD TIMED TRANSCRIPT BLOCKS ═══
    // Use 20s blocks for analysis (detailed 8s scenes are generated later in script pipeline)
    const analysisSceneDuration = 20;
    const expectedScenes = Math.max(4, Math.min(30, Math.ceil(durationSeconds / analysisSceneDuration)));
    
    let timedBlocks = '';
    if (timedTranscript.length > 0) {
      const blocks: { startTime: number; endTime: number; text: string }[] = [];
      for (let i = 0; i < expectedScenes; i++) {
        const blockStart = i * analysisSceneDuration;
        const blockEnd = Math.min((i + 1) * analysisSceneDuration, durationSeconds);
        const wordsInBlock = timedTranscript
          .filter(w => w.start >= blockStart && w.start < blockEnd)
          .map(w => w.text)
          .join(' ');
        if (wordsInBlock.trim()) {
          blocks.push({ startTime: blockStart, endTime: blockEnd, text: wordsInBlock.slice(0, 200) });
        }
      }
      timedBlocks = blocks
        .map(b => `[${formatTimestamp(b.startTime)}-${formatTimestamp(b.endTime)}] ${b.text}`)
        .join('\n');
    }

    const imageContent: any[] = validFrames.map((url) => ({
      type: "image_url",
      image_url: { url },
    }));

    const frameDescriptions = validFrames.map((_, i) => 
      i === 0 ? "Thumbnail" : "Frame ~50%"
    ).join(', ');

    const messages: any[] = [
      {
        role: "system",
        content: `Você é especialista em YouTube com 25 anos de experiência. Faça engenharia reversa completa para clonar este vídeo.

Vídeo: ${durationMinutes}min (${durationSeconds}s). Gere ${expectedScenes} blocos de cena.
Cada visual_prompt: 80-120 palavras, termine com "(no subtitles, no text, no logos, no watermarks)".

REGRAS CRÍTICAS para visual_prompt:
- NUNCA use nomes de personagens protegidos (Simpsons, Mickey, Goku etc.) — descreva pela APARÊNCIA FÍSICA
- NUNCA use nomes de celebridades/políticos — descreva pela aparência
- NUNCA use nomes de marcas — descreva genericamente
- Inclua movimento de câmera + ambiente detalhado + iluminação

Responda em português BR.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `ENGENHARIA REVERSA — VIDEO CLONE ENGINE v3

VÍDEO: "${video.snippet.title}"
Canal: "${video.snippet.channelTitle}" (${formatNumber(channelSubs)} subs)
Views: ${formatNumber(views)} | Likes: ${formatNumber(likes)} | Comentários: ${formatNumber(comments)}
Outlier: ${outlierScore}x | Duração: ${durationMinutes}min (${durationSeconds}s)
Tags: ${(video.snippet.tags || []).slice(0, 15).join(', ')}
Descrição: ${video.snippet.description?.slice(0, 400)}
${transcript ? `\nTRANSCRIÇÃO:\n${transcript.slice(0, 5000)}` : ''}
${timedBlocks ? `\nTIMESTAMPS:\n${timedBlocks}` : ''}

GERE:
1. HOOK: tipo, texto, psicologia, score
2. RETENÇÃO: fases com timestamps
3. DNA: formato, tom, gatilhos, persona, nicho
4. TÍTULO & THUMBNAIL: CTR score, power words
5. ESTILO VISUAL: baseado nos frames
6. ${expectedScenes} CENAS cobrindo ${durationMinutes}min completos
7. TEMPLATE DE CLONAGEM: roteiro de ${durationMinutes}min (~${durationMinutes * 150} palavras)`
          },
          ...imageContent,
        ]
      }
    ];



    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "video_clone_engine",
            description: "Complete reverse engineering of a viral YouTube video with visual cloning",
            parameters: {
              type: "object",
              properties: {
                hookAnalysis: {
                  type: "object",
                  properties: {
                    hookType: { type: "string" },
                    hookText: { type: "string" },
                    whyItWorks: { type: "string" },
                    powerScore: { type: "number" },
                  },
                  required: ["hookType", "hookText", "whyItWorks", "powerScore"],
                  additionalProperties: false,
                },
                retentionMap: {
                  type: "object",
                  properties: {
                    structure: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          phase: { type: "string" },
                          timeRange: { type: "string" },
                          technique: { type: "string" },
                          retentionEstimate: { type: "number" },
                        },
                        required: ["phase", "timeRange", "technique", "retentionEstimate"],
                        additionalProperties: false,
                      },
                    },
                    openLoops: { type: "array", items: { type: "string" } },
                    patternInterrupts: { type: "array", items: { type: "string" } },
                    dropPoints: { type: "array", items: { type: "string" } },
                  },
                  required: ["structure", "openLoops", "patternInterrupts", "dropPoints"],
                  additionalProperties: false,
                },
                contentDNA: {
                  type: "object",
                  properties: {
                    format: { type: "string" },
                    emotionalTone: { type: "string" },
                    psychTriggers: { type: "array", items: { type: "string" } },
                    targetPersona: { type: "string" },
                    nicheCategory: { type: "string" },
                  },
                  required: ["format", "emotionalTone", "psychTriggers", "targetPersona", "nicheCategory"],
                  additionalProperties: false,
                },
                titleAnalysis: {
                  type: "object",
                  properties: {
                    ctrScore: { type: "number" },
                    powerWords: { type: "array", items: { type: "string" } },
                    copywritingTechnique: { type: "string" },
                    thumbnailSuggestion: { type: "string" },
                  },
                  required: ["ctrScore", "powerWords", "copywritingTechnique", "thumbnailSuggestion"],
                  additionalProperties: false,
                },
                thumbnailAnalysis: {
                  type: "object",
                  properties: {
                    dominantColors: { type: "array", items: { type: "string" } },
                    hasTextOverlay: { type: "boolean" },
                    textOverlayContent: { type: "string" },
                    composition: { type: "string" },
                    emotionalExpression: { type: "string" },
                    elements: { type: "array", items: { type: "string" } },
                    clickbaitLevel: { type: "number" },
                    suggestions: { type: "array", items: { type: "string" } },
                  },
                  required: ["dominantColors", "hasTextOverlay", "textOverlayContent", "composition", "emotionalExpression", "elements", "clickbaitLevel", "suggestions"],
                  additionalProperties: false,
                },
                visualStyle: {
                  type: "object",
                  properties: {
                    primaryStyle: { type: "string", enum: ["2D Animation", "2D Cartoon", "3D Animation", "Cinematic Documentary", "Netflix Documentary", "Real Footage", "Screen Recording", "Whiteboard", "Motion Graphics", "Mixed Media", "AI Generated", "Stock Footage Compilation"] },
                    secondaryStyles: { type: "array", items: { type: "string" } },
                    faceless: { type: "boolean" },
                    editingPace: { type: "string", enum: ["Slow", "Medium", "Fast", "Ultra Fast"] },
                    colorGrading: { type: "string" },
                    transitionStyle: { type: "string" },
                    bRollUsage: { type: "string" },
                    productionLevel: { type: "string", enum: ["Low Budget", "Medium", "High Production", "Hollywood Level"] },
                    replicabilityAsFaceless: { type: "number" },
                    toolsSuggested: { type: "array", items: { type: "string" } },
                  },
                  required: ["primaryStyle", "secondaryStyles", "faceless", "editingPace", "colorGrading", "transitionStyle", "bRollUsage", "productionLevel", "replicabilityAsFaceless", "toolsSuggested"],
                  additionalProperties: false,
                },
                visualDNA: {
                  type: "object",
                  properties: {
                    colorPalette: { type: "array", items: { type: "string" } },
                    lightingStyle: { type: "string" },
                    cameraPatterns: { type: "array", items: { type: "string" } },
                    imageTypes: { type: "array", items: { type: "string" } },
                    overallAesthetic: { type: "string" },
                    referenceStylePrompt: { type: "string", description: "Master style prompt to prefix all scene prompts for consistency" },
                  },
                  required: ["colorPalette", "lightingStyle", "cameraPatterns", "imageTypes", "overallAesthetic", "referenceStylePrompt"],
                  additionalProperties: false,
                },
                sceneTimeline: {
                  type: "array",
                  description: `${expectedScenes} scene blocks covering ${durationMinutes} minutes`,
                  items: {
                    type: "object",
                    properties: {
                      sceneIndex: { type: "number" },
                      startTime: { type: "string" },
                      endTime: { type: "string" },
                      narrationSummary: { type: "string" },
                      visualPrompt: { type: "string", description: "80-120 word prompt: style + subject + action + environment + lighting. End with (no subtitles, no text, no logos, no watermarks)" },
                      mood: { type: "string" },
                      energyLevel: { type: "string", enum: ["low", "medium", "high", "explosive"] },
                    },
                    required: ["sceneIndex", "startTime", "endTime", "narrationSummary", "visualPrompt", "mood", "energyLevel"],
                    additionalProperties: false,
                  }
                },
                cloneTemplate: {
                  type: "object",
                  properties: {
                    templateStructure: { type: "string" },
                    titleVariations: { type: "array", items: { type: "string" } },
                    scriptOutline: { type: "string", description: `Script outline for ${durationMinutes}-minute video` },
                    estimatedViewsSmallChannel: { type: "string" },
                    suggestedDuration: { type: "string" },
                    thumbnailRecipe: { type: "string" },
                    hookScript: { type: "string" },
                    ctaScript: { type: "string" },
                  },
                  required: ["templateStructure", "titleVariations", "scriptOutline", "suggestedDuration", "hookScript"],
                  additionalProperties: false,
                },
                scores: {
                  type: "object",
                  properties: {
                    virality: { type: "number" },
                    replicability: { type: "number" },
                    monetization: { type: "number" },
                    overall: { type: "number" },
                  },
                  required: ["virality", "replicability", "monetization", "overall"],
                  additionalProperties: false,
                },
              },
              required: ["hookAnalysis", "retentionMap", "contentDNA", "titleAnalysis", "visualStyle", "visualDNA", "sceneTimeline", "cloneTemplate", "scores"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "video_clone_engine" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let analysis: any;
    if (toolCall) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to extract JSON from content (model may have responded as text)
      const contentText = aiData.choices?.[0]?.message?.content || '';
      console.warn("No tool_call returned, attempting content parse. finish_reason:", aiData.choices?.[0]?.finish_reason);
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error("IA retornou resposta inválida. Tente novamente.");
        }
      } else {
        throw new Error("IA não retornou dados estruturados. Tente novamente em alguns segundos.");
      }
    }

    // Force duration to match original
    if (analysis.cloneTemplate) {
      analysis.cloneTemplate.suggestedDuration = `${durationMinutes} minutos`;
      analysis.cloneTemplate.wordCountTarget = durationMinutes * 150;
    }

    // ═══ Veo3 Policy Filter on all scene visual prompts ═══
    const policyFixes: string[] = [];
    if (analysis.sceneTimeline?.length) {
      for (const scene of analysis.sceneTimeline) {
        if (scene.visualPrompt) {
          const { cleaned, fixes } = applyVeo3PolicyFilter(scene.visualPrompt);
          if (fixes.length > 0) {
            scene.visualPrompt = cleaned;
            policyFixes.push(...fixes.map(f => `Scene ${scene.sceneIndex}: ${f}`));
          }
        }
      }
    }

    console.log(`Deep scan complete: ${(analysis.sceneTimeline || []).length} scenes, ${validFrames.length} frames analyzed, policy fixes: ${policyFixes.length}`);

    // ═══ AUTO-LEARN WITH DEDUPLICATION (fire-and-forget, non-blocking) ═══
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      
      // Check if this video was already analyzed (dedup)
      const { data: existingBlueprint } = await sb.from("video_blueprints")
        .select("id").eq("video_id", videoId).maybeSingle();
      
      if (existingBlueprint) {
        console.log(`Auto-learn: video ${videoId} already analyzed, updating instead of inserting`);
      }

      const safeUpsert = async (table: string, data: any, conflictKey?: string) => {
        try {
          if (conflictKey) {
            await sb.from(table).upsert(data, { onConflict: conflictKey });
          } else {
            // Check for duplicate title before inserting
            if (data.title) {
              const { data: existing } = await sb.from(table)
                .select("id").eq("title", data.title).limit(1);
              if (existing && existing.length > 0) {
                console.log(`Dedup: skipping duplicate in ${table}: "${data.title.slice(0, 50)}"`);
                return;
              }
            }
            await sb.from(table).insert(data);
          }
        } catch { /* ignore */ }
      };

      const learnPromises: Promise<void>[] = [];

      if (analysis.hookAnalysis?.powerScore >= 7) {
        learnPromises.push(safeUpsert("script_knowledge", {
          category: "hook",
          title: `Hook: ${analysis.hookAnalysis.hookType} — "${video.snippet.title}"`,
          content: `${analysis.hookAnalysis.hookText}\n\nPor que funciona: ${analysis.hookAnalysis.whyItWorks}`,
          effectiveness_score: analysis.hookAnalysis.powerScore,
          examples: JSON.stringify([video.snippet.title]),
        }));
      }

      if (analysis.retentionMap?.structure?.length) {
        for (const phase of analysis.retentionMap.structure.filter((p: any) => p.retentionEstimate >= 70).slice(0, 3)) {
          learnPromises.push(safeInsert("script_knowledge", {
            category: "retention_technique",
            title: `${phase.phase} — ${phase.technique}`,
            content: `Técnica "${phase.technique}" na fase "${phase.phase}" (${phase.timeRange}). Retenção: ${phase.retentionEstimate}%.`,
            effectiveness_score: Math.round(phase.retentionEstimate / 10),
          }));
        }
      }

      if (analysis.contentDNA?.psychTriggers?.length) {
        learnPromises.push(safeInsert("viral_content_library", {
          category: "psychology_triggers",
          content_json: {
            triggers: analysis.contentDNA.psychTriggers,
            source_video: video.snippet.title,
            format: analysis.contentDNA.format,
            niche: analysis.contentDNA.nicheCategory,
          },
          language: "en",
          niches: [analysis.contentDNA.nicheCategory],
          effectiveness_score: Math.round(analysis.scores?.virality / 10) || 7,
        }));
      }

      if (analysis.visualStyle?.replicabilityAsFaceless >= 60) {
        learnPromises.push(safeInsert("scene_prompt_knowledge", {
          category: analysis.visualStyle.primaryStyle.toLowerCase().replace(/\s+/g, '_'),
          title: `Visual: ${analysis.visualStyle.primaryStyle} — "${video.snippet.title}"`,
          prompt_template: analysis.visualDNA?.referenceStylePrompt || `Style: ${analysis.visualStyle.primaryStyle}`,
          viral_score: Math.round(analysis.scores?.virality / 10) || 7,
          tags: JSON.stringify([analysis.visualStyle.primaryStyle]),
        }));
      }

      if (views >= 350000) {
        learnPromises.push(safeInsert("viral_titles_db", {
          title: video.snippet.title,
          channel_name: video.snippet.channelTitle,
          channel_id: video.snippet.channelId,
          views, likes,
          niche: analysis.contentDNA?.nicheCategory || 'unknown',
          why_viral: analysis.hookAnalysis?.whyItWorks || null,
          emotional_triggers: analysis.contentDNA?.psychTriggers || [],
          seo_score: analysis.titleAnalysis?.ctrScore ? Math.round(analysis.titleAnalysis.ctrScore) : 0,
          published_at: video.snippet.publishedAt,
          duration_seconds: durationSeconds,
        }));
      }

      learnPromises.push(safeInsert("video_blueprints", {
        video_id: videoId,
        video_title: video.snippet.title,
        channel_name: video.snippet.channelTitle,
        channel_id: video.snippet.channelId,
        views, likes,
        niche: analysis.contentDNA?.nicheCategory || 'unknown',
        story_structure: { format: analysis.contentDNA?.format, emotionalTone: analysis.contentDNA?.emotionalTone },
        hook_type: analysis.hookAnalysis?.hookType || null,
        hook_text: analysis.hookAnalysis?.hookText || null,
        psychological_triggers: analysis.contentDNA?.psychTriggers || [],
        narrative_style: analysis.contentDNA?.format || null,
        visual_style: analysis.visualStyle?.primaryStyle || null,
        scene_structure: analysis.sceneTimeline || [],
        retention_map: analysis.retentionMap || {},
        clone_template: analysis.cloneTemplate || {},
        scores: analysis.scores || {},
        source: 'deep-scan-v3',
      }, { onConflict: "video_id" }));

      await Promise.allSettled(learnPromises);
      console.log(`Auto-learn: saved ${learnPromises.length} insights`);
    } catch (learnErr) {
      console.error("Auto-learn error (non-fatal):", learnErr);
    }

    return new Response(JSON.stringify({
      videoInfo: {
        id: videoId,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        thumbnail: thumbnailUrl,
        views, likes, comments,
        duration: video.contentDetails.duration,
        durationSeconds,
        durationMinutes,
        publishedAt: video.snippet.publishedAt,
        tags: video.snippet.tags || [],
        outlierScore,
        channelSubs,
        hasTranscript: !!transcript,
        capturedFrames: validFrames.length,
      },
      analysis,
      autoLearn: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deep-scan-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
