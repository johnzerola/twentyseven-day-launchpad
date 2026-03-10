import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { videoId } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    if (!videoId) throw new Error("videoId is required");

    // 1. Fetch video details
    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,topicDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`);
    const vData = await vRes.json();
    const video = vData.items?.[0];
    if (!video) throw new Error("Vídeo não encontrado");

    // 2. Try to fetch captions/transcript
    let transcript = "";
    try {
      const capRes = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`);
      const capData = await capRes.json();
      const autoCap = capData.items?.find((c: any) => c.snippet.trackKind === 'asr') || capData.items?.[0];
      if (autoCap) {
        // Try fetching transcript via timedtext API (public endpoint)
        const lang = autoCap.snippet.language || 'pt';
        const ttRes = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`);
        if (ttRes.ok) {
          const ttXml = await ttRes.text();
          // Extract text from XML
          const textMatches = ttXml.match(/<text[^>]*>(.*?)<\/text>/gs);
          if (textMatches) {
            transcript = textMatches.map(m => {
              const text = m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
              return text;
            }).join(' ').slice(0, 5000);
          }
        }
      }
    } catch { /* captions not available */ }

    // 3. If no transcript, try alternative method
    if (!transcript) {
      try {
        const altRes = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=pt&fmt=srv3`);
        if (altRes.ok) {
          const altXml = await altRes.text();
          const textMatches = altXml.match(/<text[^>]*>(.*?)<\/text>/gs);
          if (textMatches) {
            transcript = textMatches.map(m => m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'")).join(' ').slice(0, 5000);
          }
        }
        if (!transcript) {
          const enRes = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`);
          if (enRes.ok) {
            const enXml = await enRes.text();
            const textMatches = enXml.match(/<text[^>]*>(.*?)<\/text>/gs);
            if (textMatches) {
              transcript = textMatches.map(m => m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'")).join(' ').slice(0, 5000);
            }
          }
        }
      } catch { /* ignore */ }
    }

    // 4. Fetch channel details for context
    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${video.snippet.channelId}&key=${YOUTUBE_API_KEY}`);
    const chData = await chRes.json();
    const channel = chData.items?.[0];
    const channelSubs = parseInt(channel?.statistics?.subscriberCount || '0');
    const channelAvgViews = parseInt(channel?.statistics?.viewCount || '0') / Math.max(parseInt(channel?.statistics?.videoCount || '1'), 1);

    const views = parseInt(video.statistics.viewCount || '0');
    const likes = parseInt(video.statistics.likeCount || '0');
    const comments = parseInt(video.statistics.commentCount || '0');
    const outlierScore = channelAvgViews > 0 ? (views / channelAvgViews).toFixed(1) : 'N/A';

    // 5. Deep AI Analysis
    const analysisPrompt = `Você é um CEO de YouTube com 25 anos de experiência, 500+ canais monetizados. Faça uma ENGENHARIA REVERSA COMPLETA deste vídeo viral.

DADOS DO VÍDEO:
- Título: "${video.snippet.title}"
- Canal: "${video.snippet.channelTitle}" (${formatNumber(channelSubs)} inscritos)
- Views: ${formatNumber(views)} | Likes: ${formatNumber(likes)} | Comentários: ${formatNumber(comments)}
- Outlier Score: ${outlierScore}x (vs média do canal)
- Publicado: ${video.snippet.publishedAt}
- Duração: ${video.contentDetails.duration}
- Tags: ${(video.snippet.tags || []).slice(0, 15).join(', ')}
- Descrição: ${video.snippet.description?.slice(0, 500)}
${transcript ? `\nTRANSCRIÇÃO (primeiros 5000 chars):\n${transcript}` : '\n(Transcrição não disponível — análise baseada em metadados)'}

ANALISE EM PROFUNDIDADE:

1. HOOK ANALYSIS (primeiros 5-30 segundos):
   - Tipo de hook usado (curiosidade, choque, promessa, polêmica, etc)
   - Por que funciona psicologicamente
   - Score de poder do hook (1-10)

2. RETENTION ENGINEERING:
   - Mapeie a estrutura de retenção (intro, desenvolvimento, clímax, CTA)
   - Identifique "open loops" e "pattern interrupts"
   - Pontos prováveis de queda de retenção e como foram mitigados
   - Técnicas de retenção usadas (listas, contagem regressiva, suspense, etc)

3. DNA DO CONTEÚDO:
   - Formato/template do vídeo (listicle, storytelling, tutorial, etc)
   - Tom emocional dominante
   - Gatilhos psicológicos ativados (FOMO, curiosidade, medo, ganância, etc)
   - Persona do público-alvo

4. TÍTULO & THUMBNAIL ANALYSIS:
   - Score de CTR estimado (1-10)
   - Palavras de poder usadas no título
   - Técnica de copywriting do título
   - Sugestão de thumbnail baseado no que provavelmente foi usado

5. CLONAGEM ACELERADA:
   - Template pronto para replicar este formato
   - 3 variações de título para um vídeo similar
   - Estrutura de roteiro baseada neste padrão
   - Estimativa de views se publicado em canal pequeno (1K-10K subs)

6. PONTUAÇÕES FINAIS:
   - Viralidade: 1-100
   - Replicabilidade: 1-100 (quão fácil é replicar como faceless)
   - Potencial de Monetização: 1-100
   - Score Geral: 1-100`;

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é o maior especialista em YouTube do mundo. 25 anos de experiência, 500+ canais monetizados. Análise técnica, direta, acionável. Responda em português BR." },
          { role: "user", content: analysisPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_deep_scan",
            description: "Return deep scan analysis of a YouTube video",
            parameters: {
              type: "object",
              properties: {
                hookAnalysis: {
                  type: "object",
                  properties: {
                    hookType: { type: "string", description: "Tipo de hook: curiosidade, choque, promessa, polêmica, pergunta, estatística" },
                    hookText: { type: "string", description: "Reconstrução do hook usado nos primeiros 5-30s" },
                    whyItWorks: { type: "string", description: "Explicação psicológica de por que funciona" },
                    powerScore: { type: "number", description: "Score 1-10 do poder do hook" },
                  },
                  required: ["hookType", "hookText", "whyItWorks", "powerScore"],
                },
                retentionMap: {
                  type: "object",
                  properties: {
                    structure: { type: "array", items: { type: "object", properties: { phase: { type: "string" }, timeRange: { type: "string" }, technique: { type: "string" }, retentionEstimate: { type: "number" } }, required: ["phase", "timeRange", "technique", "retentionEstimate"] } },
                    openLoops: { type: "array", items: { type: "string" } },
                    patternInterrupts: { type: "array", items: { type: "string" } },
                    dropPoints: { type: "array", items: { type: "string" } },
                  },
                  required: ["structure", "openLoops", "patternInterrupts", "dropPoints"],
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
                },
                cloneTemplate: {
                  type: "object",
                  properties: {
                    templateStructure: { type: "string", description: "Template passo-a-passo para replicar" },
                    titleVariations: { type: "array", items: { type: "string" } },
                    scriptOutline: { type: "string", description: "Estrutura de roteiro baseada no padrão" },
                    estimatedViewsSmallChannel: { type: "string" },
                  },
                  required: ["templateStructure", "titleVariations", "scriptOutline", "estimatedViewsSmallChannel"],
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
                },
              },
              required: ["hookAnalysis", "retentionMap", "contentDNA", "titleAnalysis", "cloneTemplate", "scores"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_deep_scan" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No AI response");
    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      videoInfo: {
        id: videoId,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        thumbnail: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
        views, likes, comments,
        duration: video.contentDetails.duration,
        publishedAt: video.snippet.publishedAt,
        tags: video.snippet.tags || [],
        outlierScore,
        channelSubs,
        hasTranscript: !!transcript,
      },
      analysis,
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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}
