import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function extractTranscript(xml: string): string {
  const textMatches = xml.match(/<text[^>]*>(.*?)<\/text>/gs);
  if (!textMatches) return "";
  return textMatches
    .map(m => m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
    .join(' ')
    .slice(0, 8000);
}

async function fetchTranscript(videoId: string): Promise<string> {
  for (const lang of ['pt', 'en', 'es', 'de', 'pl']) {
    try {
      const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`);
      if (res.ok) {
        const xml = await res.text();
        const t = extractTranscript(xml);
        if (t) return t;
      } else {
        await res.text(); // consume body
      }
    } catch { /* continue */ }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { videoId } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!videoId) throw new Error("videoId is required");

    // 1. Fetch video + channel details in parallel
    const [vRes, transcriptPromise] = await Promise.all([
      fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,topicDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`),
      fetchTranscript(videoId),
    ]);

    const vData = await vRes.json();
    const video = vData.items?.[0];
    if (!video) throw new Error("Vídeo não encontrado");
    const transcript = transcriptPromise;

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

    const thumbnailUrl = video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || '';

    // 3. Build the analysis prompt with thumbnail for multimodal analysis
    const messages: any[] = [
      {
        role: "system",
        content: `Você é o maior especialista em YouTube do mundo — CEO com 25 anos, 1000+ canais monetizados. Faça uma ENGENHARIA REVERSA COMPLETA incluindo análise visual de thumbnail e detecção de estilo do vídeo. Responda em português BR.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `ENGENHARIA REVERSA — VIDEO CLONE ENGINE

DADOS DO VÍDEO:
- Título: "${video.snippet.title}"
- Canal: "${video.snippet.channelTitle}" (${formatNumber(channelSubs)} subs)
- Views: ${formatNumber(views)} | Likes: ${formatNumber(likes)} | Comentários: ${formatNumber(comments)}
- Outlier Score: ${outlierScore}x
- Publicado: ${video.snippet.publishedAt}
- Duração: ${video.contentDetails.duration}
- Tags: ${(video.snippet.tags || []).slice(0, 20).join(', ')}
- Descrição: ${video.snippet.description?.slice(0, 600)}
${transcript ? `\nTRANSCRIÇÃO (primeiros 8000 chars):\n${transcript}` : '\n(Transcrição não disponível)'}

ANALISE:
1. HOOK (5-30s): tipo, texto reconstruído, psicologia, score
2. RETENÇÃO: estrutura por fases, open loops, pattern interrupts, pontos de queda
3. DNA: formato, tom emocional, gatilhos, persona, nicho
4. TÍTULO & THUMBNAIL: CTR score, power words, técnica de copy, análise visual da thumbnail (cores, composição, elementos, texto overlay)
5. ESTILO VISUAL: detecte o estilo do vídeo (2D animação, 3D, cartoon, cinematográfico, documentary, footage real, screen recording, whiteboard, etc.)
6. SEGMENTOS MAIS ASSISTIDOS: estime quais partes do vídeo têm picos de rewatch baseado na estrutura
7. CLONAGEM: template completo, variações de título, roteiro estruturado, estimativa de views
8. SCORES: viralidade, replicabilidade, monetização, overall`
          },
          ...(thumbnailUrl ? [{
            type: "image_url",
            image_url: { url: thumbnailUrl }
          }] : [])
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
            description: "Complete reverse engineering of a viral YouTube video",
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
                    dominantColors: { type: "array", items: { type: "string" }, description: "Main colors used" },
                    hasTextOverlay: { type: "boolean" },
                    textOverlayContent: { type: "string", description: "Text visible on thumbnail" },
                    composition: { type: "string", description: "Layout: centered face, split, collage, etc." },
                    emotionalExpression: { type: "string", description: "Facial expression or emotional vibe" },
                    elements: { type: "array", items: { type: "string" }, description: "Key visual elements" },
                    clickbaitLevel: { type: "number", description: "1-10 clickbait level" },
                    suggestions: { type: "array", items: { type: "string" }, description: "How to improve this thumbnail" },
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
                    colorGrading: { type: "string", description: "Color palette/mood" },
                    transitionStyle: { type: "string" },
                    bRollUsage: { type: "string", description: "How B-roll is used" },
                    productionLevel: { type: "string", enum: ["Low Budget", "Medium", "High Production", "Hollywood Level"] },
                    replicabilityAsFaceless: { type: "number", description: "0-100 how easy to replicate as faceless" },
                    toolsSuggested: { type: "array", items: { type: "string" }, description: "Tools to recreate this style" },
                  },
                  required: ["primaryStyle", "secondaryStyles", "faceless", "editingPace", "colorGrading", "transitionStyle", "bRollUsage", "productionLevel", "replicabilityAsFaceless", "toolsSuggested"],
                  additionalProperties: false,
                },
                rewatchSegments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      timeRange: { type: "string" },
                      reason: { type: "string" },
                      rewatchScore: { type: "number", description: "1-10" },
                      contentSummary: { type: "string" },
                    },
                    required: ["timeRange", "reason", "rewatchScore", "contentSummary"],
                    additionalProperties: false,
                  },
                  description: "Estimated most rewatched segments",
                },
                cloneTemplate: {
                  type: "object",
                  properties: {
                    templateStructure: { type: "string" },
                    titleVariations: { type: "array", items: { type: "string" } },
                    scriptOutline: { type: "string" },
                    estimatedViewsSmallChannel: { type: "string" },
                    suggestedDuration: { type: "string" },
                    thumbnailRecipe: { type: "string", description: "Step-by-step to recreate thumbnail" },
                    hookScript: { type: "string", description: "Ready-to-use hook script for clone" },
                    ctaScript: { type: "string", description: "Ready-to-use CTA script" },
                  },
                  required: ["templateStructure", "titleVariations", "scriptOutline", "estimatedViewsSmallChannel", "suggestedDuration", "thumbnailRecipe", "hookScript", "ctaScript"],
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
              required: ["hookAnalysis", "retentionMap", "contentDNA", "titleAnalysis", "thumbnailAnalysis", "visualStyle", "rewatchSegments", "cloneTemplate", "scores"],
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
    if (!toolCall) throw new Error("No AI response");
    const analysis = JSON.parse(toolCall.function.arguments);

    // ========== AUTO-LEARN: Save insights to knowledge tables ==========
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const learnPromises: Promise<any>[] = [];

      // 1. Save hook to script_knowledge
      if (analysis.hookAnalysis?.powerScore >= 7) {
        learnPromises.push(sb.from("script_knowledge").insert({
          category: "hook",
          title: `Hook: ${analysis.hookAnalysis.hookType} — "${video.snippet.title}"`,
          content: `${analysis.hookAnalysis.hookText}\n\nPor que funciona: ${analysis.hookAnalysis.whyItWorks}`,
          effectiveness_score: analysis.hookAnalysis.powerScore,
          examples: JSON.stringify([video.snippet.title]),
        }));
      }

      // 2. Save retention techniques
      if (analysis.retentionMap?.structure?.length) {
        for (const phase of analysis.retentionMap.structure.filter((p: any) => p.retentionEstimate >= 70).slice(0, 3)) {
          learnPromises.push(sb.from("script_knowledge").insert({
            category: "retention_technique",
            title: `${phase.phase} — ${phase.technique}`,
            content: `Técnica de retenção "${phase.technique}" usada na fase "${phase.phase}" (${phase.timeRange}). Retenção estimada: ${phase.retentionEstimate}%. Extraída do vídeo "${video.snippet.title}" do canal "${video.snippet.channelTitle}".`,
            effectiveness_score: Math.round(phase.retentionEstimate / 10),
            examples: JSON.stringify([`${video.snippet.title} (${phase.timeRange})`]),
          }));
        }
      }

      // 3. Save psychology triggers to viral_content_library
      if (analysis.contentDNA?.psychTriggers?.length) {
        learnPromises.push(sb.from("viral_content_library").insert({
          category: "psychology_triggers",
          content_json: {
            triggers: analysis.contentDNA.psychTriggers,
            source_video: video.snippet.title,
            source_channel: video.snippet.channelTitle,
            format: analysis.contentDNA.format,
            emotional_tone: analysis.contentDNA.emotionalTone,
            niche: analysis.contentDNA.nicheCategory,
          },
          language: "en",
          niches: [analysis.contentDNA.nicheCategory],
          effectiveness_score: Math.round(analysis.scores?.virality / 10) || 7,
        }));
      }

      // 4. Save visual style as scene prompt knowledge
      if (analysis.visualStyle?.replicabilityAsFaceless >= 60) {
        learnPromises.push(sb.from("scene_prompt_knowledge").insert({
          category: analysis.visualStyle.primaryStyle.toLowerCase().replace(/\s+/g, '_'),
          title: `Visual: ${analysis.visualStyle.primaryStyle} — "${video.snippet.title}"`,
          prompt_template: `Style: ${analysis.visualStyle.primaryStyle}. Color grading: ${analysis.visualStyle.colorGrading}. Transitions: ${analysis.visualStyle.transitionStyle}. B-roll: ${analysis.visualStyle.bRollUsage}. Editing pace: ${analysis.visualStyle.editingPace}. Production: ${analysis.visualStyle.productionLevel}. Tools: ${(analysis.visualStyle.toolsSuggested || []).join(', ')}.`,
          viral_score: Math.round(analysis.scores?.virality / 10) || 7,
          tags: JSON.stringify([analysis.visualStyle.primaryStyle, ...analysis.visualStyle.secondaryStyles || []]),
        }));
      }

      // 5. Save title to viral_titles_db if high performing
      if (views >= 350000) {
        learnPromises.push(sb.from("viral_titles_db").insert({
          title: video.snippet.title,
          channel_name: video.snippet.channelTitle,
          channel_id: video.snippet.channelId,
          views,
          likes,
          niche: analysis.contentDNA?.nicheCategory || 'unknown',
          why_viral: analysis.hookAnalysis?.whyItWorks || null,
          title_pattern: analysis.titleAnalysis?.copywritingTechnique || null,
          emotional_triggers: analysis.contentDNA?.psychTriggers || [],
          seo_score: analysis.titleAnalysis?.ctrScore ? Math.round(analysis.titleAnalysis.ctrScore) : 0,
          published_at: video.snippet.publishedAt,
          duration_seconds: (() => {
            const d = video.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            return d ? (parseInt(d[1]||'0')*3600 + parseInt(d[2]||'0')*60 + parseInt(d[3]||'0')) : 0;
          })(),
        }).then(() => {}).catch(() => {})));
      }

      await Promise.allSettled(learnPromises);
      console.log(`Auto-learn: saved ${learnPromises.length} insights from "${video.snippet.title}"`);
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
        publishedAt: video.snippet.publishedAt,
        tags: video.snippet.tags || [],
        outlierScore,
        channelSubs,
        hasTranscript: !!transcript,
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
