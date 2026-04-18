import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { TITLE_ENGINEERING_INJECTION } from "../_shared/dark-channel-strategy-2026.ts";
import { ANTI_SLOP_FOR_TITLES } from "../_shared/anti-slop-rules.ts";
import { enhanceWithCritic } from "../_shared/squad-runner.ts";
import { fetchUserCtrPatternsBlock } from "../_shared/learning-loop-injector.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Helper: call AI via direct Gemini (preferred, zero credit cost) with Gateway fallback
async function callAI(prompt: string, systemPrompt: string, apiKey: string, lovableKey: string | undefined, opts?: { temperature?: number }): Promise<string> {
  const temp = opts?.temperature ?? 0.9;
  
  // PRIMARY: Direct Gemini API (zero credit cost)
  if (apiKey) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: temp, responseMimeType: "application/json", maxOutputTokens: 8192 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) return text;
      }
      const errText = await res.text();
      console.warn("Direct Gemini error:", res.status, errText.slice(0, 200));
      // Fall through to gateway on 429/quota errors
      if (res.status !== 429 && res.status !== 403) throw new Error(`Gemini error: ${res.status}`);
    } catch (e) {
      console.warn("Direct Gemini failed, trying gateway:", (e as Error).message);
    }
  }

  // FALLBACK: Lovable Gateway (costs credits)
  if (lovableKey) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: temp,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Lovable Gateway error:", res.status, t);
      throw new Error(`AI error: ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error("No AI API key available");
}

// ========== HELPER: Search YouTube for competing videos ==========
async function searchYouTubeCompetitors(topic: string, niche: string, language: string, YOUTUBE_API_KEY: string): Promise<string> {
  try {
    const queries = [
      topic,
      `${niche} ${topic}`.slice(0, 80),
    ];
    const allResults: any[] = [];

    for (const q of queries) {
      const params = new URLSearchParams({
        part: 'snippet',
        q,
        type: 'video',
        order: 'viewCount',
        maxResults: '10',
        relevanceLanguage: language === 'pt' ? 'pt' : language === 'es' ? 'es' : 'en',
        key: YOUTUBE_API_KEY,
      });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.items?.length) allResults.push(...data.items);
      }
    }

    if (!allResults.length) return '';

    // Get video stats for the found videos
    const videoIds = [...new Set(allResults.map((r: any) => r.id?.videoId).filter(Boolean))].slice(0, 15);
    if (!videoIds.length) return '';

    const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`);
    if (!statsRes.ok) return '';
    const statsData = await statsRes.json();

    const competitors = (statsData.items || [])
      .map((v: any) => ({
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        views: parseInt(v.statistics.viewCount || '0'),
        likes: parseInt(v.statistics.likeCount || '0'),
      }))
      .sort((a: any, b: any) => b.views - a.views)
      .slice(0, 12);

    if (!competitors.length) return '';

    return `\n\n🔍 ANÁLISE DE CONCORRENTES EM TEMPO REAL (${competitors.length} vídeos encontrados no YouTube AGORA sobre este tema):\n${competitors.map((c: any, i: number) => `${i + 1}. "${c.title}" — ${c.channel} (${c.views.toLocaleString()} views, ${c.likes.toLocaleString()} likes)`).join('\n')}\n\n⚡ ESTRATÉGIA: Seus títulos devem ser MELHORES que estes. Analise o que funciona neles e SUPERE. Diferencie-se — não repita o mesmo ângulo. Encontre gaps que eles não cobriram.`;
  } catch (e) {
    console.error("YouTube competitor search error:", e);
    return '';
  }
}

// ========== HELPER: Brave Search for trending keywords ==========
async function searchBraveTrending(topic: string, niche: string, language: string, sb: any): Promise<string> {
  try {
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    if (!BRAVE_API_KEY) return '';

    // Check cache first
    const cacheKey = `titles_brave:${topic}:${niche}:${language}`;
    const { data: cached } = await sb
      .from("research_cache")
      .select("result_json")
      .eq("cache_key", cacheKey)
      .eq("source", "brave")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.result_json) {
      return cached.result_json as string;
    }

    // COST OPTIMIZATION: 1 query instead of 2 (reduce Brave API calls by 50%)
    const queries = [
      `${topic} ${niche || ''} ${language === 'pt' ? 'youtube viral 2025 2026' : 'youtube trending 2025 2026'}`,
    ];

    const allSnippets: string[] = [];

    for (const q of queries) {
      const params = new URLSearchParams({ q, count: '5' });
      if (language) params.set("search_lang", language);

      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": BRAVE_API_KEY,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.web?.results || [];
        results.forEach((r: any) => {
          allSnippets.push(`• "${r.title}" — ${r.description?.slice(0, 120) || ''}`);
        });
      }
    }

    if (!allSnippets.length) return '';

    const block = `\n\n🌐 TENDÊNCIAS WEB EM TEMPO REAL (Brave Search):\n${allSnippets.slice(0, 8).join('\n')}\n\nUse estas tendências para criar títulos que capturam o zeitgeist atual. Incorpore termos trending nos títulos.`;

    // Cache for 24h
    try { await sb.from("research_cache").upsert({
      cache_key: cacheKey,
      source: "brave",
      result_json: block,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key,source" }); } catch { /* non-blocking */ }

    return block;
  } catch (e) {
    console.error("Brave trending search error:", e);
    return '';
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get("authorization") || '';
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type = "generate" } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!LOVABLE_API_KEY && !GOOGLE_AI_API_KEY) throw new Error("No AI API key configured");

    const geminiUrl = `${GEMINI_URL}?key=${GOOGLE_AI_API_KEY || ''}`;
    const geminiHeaders = { "Content-Type": "application/json" };

    // ========== SAVE LEARNING (feedback loop) ==========
    if (type === "learn") {
      const { title, style, ctr, niche: learnNiche, action } = body;
      try {
        await sb.from('ai_learning').insert({
          topic: `title_${action}`,
          source: 'title_generator',
          insight: JSON.stringify({ title, style, ctr, niche: learnNiche, action, timestamp: new Date().toISOString() }),
        });
      } catch { /* non-blocking */ }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GENERATE TITLES (UPGRADED) ==========
    if (type === "generate") {
      const { niche, topic, language, country, scriptContext } = body;
      const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");

      // Script context block
      let scriptContextBlock = '';
      if (scriptContext) {
        scriptContextBlock = `\n\n📹 CONTEXTO COMPLETO DO VÍDEO (use para criar títulos PRECISOS):\n${scriptContext}\n\nOs títulos DEVEM refletir o conteúdo acima. Extraia os ângulos mais clicáveis do roteiro real.`;
      }

      // ===== PARALLEL: Knowledge DB + YouTube Competitors + Brave Trends =====
      let viralRefBlock = '';
      let psychologyBlock = '';
      let formatsBlock = '';
      let hooksBlock = '';
      let dynamicPatternsBlock = '';
      let learningBlock = '';
      let competitorBlock = '';
      let braveBlock = '';

      const searchTopic = topic || niche || '';

      try {
        // Build all queries
        let titlesQuery = sb.from('viral_titles_db')
          .select('title,views,why_viral,title_pattern,niche,language,emotional_triggers')
          .order('views', { ascending: false })
          .limit(80);
        if (language) titlesQuery = titlesQuery.eq('language', language);
        if (niche) titlesQuery = titlesQuery.ilike('niche', `%${niche}%`);

        let hooksQuery = sb.from('hook_library')
          .select('hook_text,hook_type,retention_score,niche')
          .order('retention_score', { ascending: false })
          .limit(25);
        if (niche) hooksQuery = hooksQuery.or(`niche.ilike.%${niche}%,niche.is.null`);

        // Fire ALL searches in parallel (DB + YouTube + Brave)
        const [
          titlesRes, triggersRes, formatsRes, psychPatternsRes, hooksRes, patternsRes, learningRes,
          ytCompetitors, braveTrending
        ] = await Promise.all([
          titlesQuery,
          sb.from('viral_content_library').select('content_json,effectiveness_score').eq('category', 'psychology_triggers').order('effectiveness_score', { ascending: false }).limit(10),
          sb.from('viral_content_library').select('content_json,effectiveness_score').eq('category', 'content_format').order('effectiveness_score', { ascending: false }).limit(8),
          sb.from('audience_psychology_patterns').select('trigger_type,description,example_titles,retention_score').order('retention_score', { ascending: false }).limit(10),
          hooksQuery,
          sb.from('viral_titles_db').select('title_pattern').not('title_pattern', 'is', null).limit(500),
          sb.from('ai_learning').select('insight').eq('topic', 'title_chosen').order('created_at', { ascending: false }).limit(15),
          // Real-time competitor research
          YOUTUBE_API_KEY && searchTopic ? searchYouTubeCompetitors(searchTopic, niche || '', language || 'pt', YOUTUBE_API_KEY) : Promise.resolve(''),
          searchTopic ? searchBraveTrending(searchTopic, niche || '', language || 'pt', sb) : Promise.resolve(''),
        ]);

        competitorBlock = ytCompetitors;
        braveBlock = braveTrending;

        // --- Viral titles refs ---
        const viralTitles = titlesRes.data;
        if (viralTitles?.length) {
          viralRefBlock = `\n\nTÍTULOS VIRAIS REAIS DE REFERÊNCIA (${viralTitles.length} títulos comprovados):\n${viralTitles.map((t: any) => `• "${t.title}" (${t.views?.toLocaleString()} views) — Pattern: ${t.title_pattern || '?'} | Why: ${t.why_viral || 'N/A'} | Triggers: ${(t.emotional_triggers || []).join(', ')}`).join('\n')}\n\nAplique as mesmas técnicas. Não copie, adapte.`;
        }

        // --- Dynamic patterns ---
        const allPatterns = patternsRes.data;
        if (allPatterns?.length) {
          const uniquePatterns = [...new Set(allPatterns.map((p: any) => p.title_pattern?.toLowerCase()).filter(Boolean))];
          if (uniquePatterns.length > 0) {
            dynamicPatternsBlock = `\n\n🎯 PADRÕES DE TÍTULO REAIS (${uniquePatterns.length} padrões):\n${uniquePatterns.map(p => `• ${p}`).join('\n')}\n\nDistribua os 20 títulos entre vários padrões.`;
          }
        }

        // --- Hooks ---
        const hooks = hooksRes.data;
        if (hooks?.length) {
          hooksBlock = `\n\n🔥 HOOKS VIRAIS COMPROVADOS:\n${hooks.map((h: any) => `• [${h.hook_type}] "${h.hook_text}" (retenção: ${h.retention_score}/10)`).join('\n')}`;
        }

        // --- Psychology triggers ---
        const triggers = triggersRes.data;
        if (triggers?.length) {
          psychologyBlock = `\n\n🧠 GATILHOS PSICOLÓGICOS:\n${triggers.map((t: any) => {
            const c = t.content_json;
            return `• ${c.name || c.trigger}: ${c.description || c.tip || ''} (score: ${t.effectiveness_score}/10)`;
          }).join('\n')}`;
        }

        // --- Content formats ---
        const formats = formatsRes.data;
        if (formats?.length) {
          formatsBlock = `\n\n🎬 FORMATOS VIRAL:\n${formats.map((f: any) => {
            const c = f.content_json;
            return `• ${c.name || c.format}: ${c.description || c.hook_style || ''} — Título ideal: ${c.title_pattern || c.example_title || 'N/A'}`;
          }).join('\n')}`;
        }

        // --- Audience psychology patterns ---
        const psychPatterns = psychPatternsRes.data;
        if (psychPatterns?.length) {
          formatsBlock += `\n\n🧪 PADRÕES DE PSICOLOGIA DA AUDIÊNCIA:\n${psychPatterns.map((p: any) => {
            const titles = Array.isArray(p.example_titles) ? p.example_titles.slice(0, 2).map((t: string) => `"${t}"`).join(', ') : '';
            return `• ${p.trigger_type}: ${p.description?.slice(0, 150)}${titles ? ` — Ex: ${titles}` : ''}`;
          }).join('\n')}`;
        }

        // --- User learning ---
        const learnings = learningRes.data;
        if (learnings?.length) {
          const parsed = learnings.map((l: any) => { try { return JSON.parse(l.insight); } catch { return null; } }).filter(Boolean);
          if (parsed.length) {
            const preferredStyles = parsed.map((p: any) => p.style).filter(Boolean);
            const styleCounts: Record<string, number> = {};
            preferredStyles.forEach((s: string) => { styleCounts[s] = (styleCounts[s] || 0) + 1; });
            const topStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
            learningBlock = `\n\n📊 PREFERÊNCIAS DO USUÁRIO:\n• Estilos preferidos: ${topStyles.map(([s, c]) => `${s} (${c}x)`).join(', ')}\n• Títulos que o usuário gostou: ${parsed.slice(0, 5).map((p: any) => `"${p.title}"`).join(', ')}\nPriorize estes estilos mas mantenha diversidade.`;
          }
        }
      } catch { /* knowledge sources optional */ }

      const langContext = language ? `\nIdioma do título: ${language}` : '';
      const countryContext = country ? `\nPaís alvo: ${country}` : '';

      const prompt = `Gere exatamente 20 títulos virais para YouTube com CTR potencial de 15-35%.
${niche ? `Nicho: ${niche}` : ''}
${topic ? `Tema específico: ${topic}` : ''}${langContext}${countryContext}
${competitorBlock}
${braveBlock}
${viralRefBlock}
${dynamicPatternsBlock}
${hooksBlock}
${psychologyBlock}
${formatsBlock}
${learningBlock}
${scriptContextBlock}

═══ INFORMATION GAP THEORY (TEORIA DA LACUNA DE INFORMAÇÃO) ═══
O clique NÃO é racional — é um REFLEXO EMOCIONAL. Título e thumbnail não descrevem o vídeo;
eles criam um MISTÉRIO PERTURBADOR ou IRRESISTÍVEL. O cérebro ODEIA lacunas de informação
e PRECISA fechá-las (Efeito Zeigarnik). Explore isso em CADA título.

═══ 10 FÓRMULAS MATEMÁTICAS DE TÍTULOS VIRAIS (use pelo menos 6 delas) ═══
1. O SEGREDO OCULTO: "A verdade perturbadora que a [Indústria/Pessoa] escondeu"
2. O ERRO FATAL: "Por que 99% das pessoas erram ao [Ação Comum]"
3. CONTRASTE ABSURDO: "Como um [Objeto Simples] gerou [Resultado Milionário/Catastrófico]"
4. DESAFIO DO TEMPO: "Eu testei [Ação] por 30 dias e meu corpo [Consequência]"
5. ARQUIVOS NÃO REVELADOS: "As imagens que [Autoridade] tentou apagar da internet"
6. NEGATIVIDADE/AVISO: "Pare de fazer [Ação Comum] imediatamente" — explora viés da negatividade
7. CURIOSIDADE INVERSA: "O que acontece quando você [Ação Bizarra] por 30 dias" — gatilho de experimento
8. PROMESSA CONDICIONAL: "Se você fizer isso 1× por dia, seu [Resultado] muda em [Tempo]" — promessa tangível
9. QUESTÃO PERTURBADORA: "E se [Fato Aceito] fosse completamente falso?" — descrença + curiosidade profunda
10. PESSOA SIMPLES: "O [Pessoa Anônima] que [Resultado Extraordinário] com [Coisa Simples]" — narrativa underdog

REGRAS PARA CTR MÁXIMO:
1. MÁXIMO 50 caracteres (para não cortar no mobile) — ideal 40-50
2. NUNCA entregar a resposta no título — o título cria o MISTÉRIO, o vídeo entrega
3. Use PALAVRAS DE PODER: Assustador, Proibido, Ilegal, Gênio, Estúpido, Destruiu, Vazou, Perturbador, Oculto
4. Use números ímpares quando aplicável (7, 13, 21 performam melhor)
5. Comece com a palavra mais impactante — a primeira palavra define o clique
6. Misture MAIÚSCULAS estrategicamente (max 2-3 palavras) para destacar
7. Crie curiosity gaps: o título DEVE fazer o viewer PRECISAR saber mais
8. Use contraste emocional: "A verdade LINDA sobre [coisa terrível]"
9. Evite clickbait puro — prometa algo que o vídeo entrega
10. Adapte ao idioma/cultura do público-alvo${language ? ` (${language})` : ''}
11. Cada título deve usar um padrão/estilo DIFERENTE — máxima diversidade
12. DIFERENCIE-SE dos concorrentes acima — encontre ângulos que eles NÃO usaram
13. Incorpore termos trending detectados pelo Brave Search
14. Explore o Viés da Negatividade: o cérebro foca 3x mais em ameaças e erros que em positividade

Para cada título, classifique o estilo e estime o CTR de 5 a 35%.`;

      // ⭐ LEARNING LOOP: inject real CTR patterns from this user's published videos
      const ctrPatternsBlock = await fetchUserCtrPatternsBlock(sb, claimsData.claims.sub as string, niche);

      const systemMsg = `Você é o maior especialista mundial em YouTube CTR optimization. Seus títulos consistentemente alcançam 15-30% de CTR. Você analisou os concorrentes em tempo real e conhece todos os padrões psicológicos que fazem as pessoas clicarem compulsivamente. Pense como MrBeast, VeeFriends e os melhores criadores. Seus títulos devem ser SUPERIORES aos concorrentes encontrados.\n\n${TITLE_ENGINEERING_INJECTION}\n\n${ANTI_SLOP_FOR_TITLES}${ctrPatternsBlock}`;
      const userMsg = `${prompt}\n\nResponda APENAS em JSON válido com esta estrutura:\n{"competitor_analysis": "string", "titles": [{"title": "string", "style": "string", "estimatedCTR": number, "hook_used": "string", "psychological_trigger": "string", "differentiation": "string"}]}`;

      let content: string;
      try {
        content = await callAI(userMsg, systemMsg, GOOGLE_AI_API_KEY || '', LOVABLE_API_KEY, { temperature: 0.9 });
      } catch (err: any) {
        if (err.message?.includes('429')) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw err;
      }
      if (!content) throw new Error("No content in response");
      const parsed = JSON.parse(content);

      // Log execution for monitoring
      try { await sb.from('execution_logs').insert({
        function_name: 'generate-titles',
        success: true,
        api_calls_made: (competitorBlock ? 3 : 1) + (braveBlock ? 2 : 0),
        metadata: {
          topic, niche, language,
          competitors_found: competitorBlock ? true : false,
          brave_used: braveBlock ? true : false,
          titles_count: parsed.titles?.length || 0,
          model: 'gemini-2.5-flash',
        },
      }); } catch { /* non-blocking */ }

      // Add epistemic honesty labels to each title
      const labeledTitles = (parsed.titles || []).map((t: any) => ({
        ...t,
        ctr_source: 'ai_estimate',
        ctr_calibration_note: 'CTR estimado pela IA sem calibração por nicho/idioma/canal — use como referência relativa.',
      }));

      // ═══ SQUAD ENHANCEMENT: Critic refines titles ═══
      let squadEnhanced = null;
      try {
        const criticResult = await enhanceWithCritic(
          GOOGLE_AI_API_KEY || '', LOVABLE_API_KEY || '',
          JSON.stringify(labeledTitles, null, 2),
          { niche, topic, language, type: 'titles' },
          `Você é um crítico expert de títulos YouTube. Analise os títulos e:
1. Identifique títulos genéricos/clichês e sugira versões mais impactantes
2. Verifique se cada título tem curiosity gap REAL
3. Elimine títulos muito longos (>60 chars) ou muito vagos
4. Sugira 5 títulos ADICIONAIS que exploram ângulos que faltaram
5. Reescreva os 3 piores títulos com versões 10x melhores
Responda em JSON: {"improved_titles": [...], "extra_titles": [...], "removed": [...], "critique": "string"}`
        );
        if (criticResult.enhanced) {
          try {
            const enhancedData = JSON.parse(criticResult.enhanced.match(/\{[\s\S]*\}/)?.[0] || '{}');
            squadEnhanced = enhancedData;
          } catch { squadEnhanced = { raw_critique: criticResult.critique }; }
        }
      } catch (e) { console.warn("Squad enhancement skipped:", (e as Error).message); }

      return new Response(JSON.stringify({
        titles: labeledTitles,
        competitor_analysis: parsed.competitor_analysis,
        confidence_source: 'ai_estimate',
        squad_enhanced: squadEnhanced,
        research: {
          competitors_analyzed: competitorBlock ? true : false,
          brave_trends_used: braveBlock ? true : false,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== A/B TEST (UPGRADED: multi-perspective) ==========
    if (type === "ab-test") {
      const { titleA, titleB, language, niche } = body;
      const langNote = language ? `\nIdioma dos títulos: ${language}.` : '';

      // Fetch relevant competitor titles for context
      let competitorContext = '';
      const { data: compTitles } = await sb.from('viral_titles_db')
        .select('title,views,title_pattern')
        .order('views', { ascending: false })
        .limit(10);
      if (compTitles?.length) {
        competitorContext = `\n\nTítulos top do YouTube para referência:\n${compTitles.map((t: any) => `• "${t.title}" (${t.views?.toLocaleString()} views)`).join('\n')}`;
      }

      const prompt = `Analise estes 2 títulos de YouTube como um especialista em CTR:

Título A: "${titleA}"
Título B: "${titleB}"${langNote}${competitorContext}

Analise com profundidade: CTR estimado (5-30%), gatilhos emocionais, SEO score (1-10), score de comprimento (1-10, ideal 50-65 chars), curiosity gap score (1-10), e uma análise comparativa detalhada de 3-4 frases. Compare com os títulos top de referência.`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: geminiHeaders,
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `SYSTEM: Você é um especialista em YouTube analytics, CTR optimization e psicologia de cliques. Analise com dados reais e padrões comprovados.\n\n${prompt}\n\nResponda APENAS em JSON válido com esta estrutura:\n{"winner": "A" ou "B", "titleA": {"ctr": number, "emotionalTriggers": ["string"], "seoScore": number, "lengthScore": number, "curiosityGapScore": number}, "titleB": {"ctr": number, "emotionalTriggers": ["string"], "seoScore": number, "lengthScore": number, "curiosityGapScore": number}, "analysis": "string", "improvement_suggestion": "string"}` }] },
          ],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini AB error:", response.status, errText);
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const result = await response.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("No content in response");
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== SEO DESCRIPTION (UPGRADED: Brave + competitive keywords) ==========
    if (type === "seo-description") {
      const { title, niche, language, scriptContext } = body;
      const langNote = language ? `\nIdioma: ${language}. Escreva neste idioma.` : '';
      const hasTimestamps = scriptContext && scriptContext.includes('[');
      const scriptNote = scriptContext ? `\n\nCONTEXTO DO VÍDEO COM TRANSCRIÇÃO TIMESTAMPED:\n${scriptContext}` : '';

      // Brave Search for trending SEO keywords
      let seoTrends = '';
      try {
        const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
        if (BRAVE_API_KEY && title) {
          // Check cache
          const cacheKey = `seo_brave:${title.slice(0, 50)}:${niche || ''}`;
          const { data: cached } = await sb.from("research_cache")
            .select("result_json")
            .eq("cache_key", cacheKey)
            .eq("source", "brave")
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();

          if (cached?.result_json) {
            seoTrends = cached.result_json as string;
          } else {
            const params = new URLSearchParams({ q: `${title} ${niche || ''} site:youtube.com`, count: '5' });
            if (language) params.set("search_lang", language);
            const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
              headers: { Accept: "application/json", "X-Subscription-Token": BRAVE_API_KEY },
            });
            if (res.ok) {
              const data = await res.json();
              const results = data.web?.results || [];
              if (results.length) {
                seoTrends = `\n\n🔍 PESQUISA WEB PARA SEO (keywords reais encontradas):\n${results.slice(0, 5).map((r: any) => `• "${r.title}" — ${r.description?.slice(0, 100) || ''}`).join('\n')}\n\nExtraia keywords destes resultados para a descrição SEO.`;
                try { await sb.from("research_cache").upsert({
                  cache_key: cacheKey, source: "brave", result_json: seoTrends,
                  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                }, { onConflict: "cache_key,source" }); } catch { /* non-blocking */ }
              }
            }
          }
        }
      } catch { /* non-blocking */ }

      const prompt = `Gere uma descrição SEO COMPLETA e PROFISSIONAL para um vídeo do YouTube.

Título: "${title}"
${niche ? `Nicho: ${niche}` : ''}${langNote}${scriptNote}${seoTrends}

A descrição deve incluir:
1. Primeira linha: keyword principal + benefício (aparece no search — CRUCIAL para SEO)
2. Parágrafo de contexto (2-3 linhas com keywords naturais)
3. ${hasTimestamps ? 'Timestamps/capítulos REAIS baseados na transcrição — use os timestamps [MM:SS] para criar capítulos que refletem o conteúdo real. Comece com 00:00. Agrupe cenas relacionadas em capítulos de 1-3 minutos.' : 'Timestamps/capítulos sugeridos (00:00 formato)'}
4. Seção "Neste vídeo você vai aprender:" com 3-5 bullet points
5. CTA para inscrição + like
6. Links placeholder para redes sociais
7. 3-5 hashtags relevantes (trending se possível)
8. 10-15 keywords SEO extraídas do conteúdo real + tendências web

IMPORTANTE: Os capítulos (timestamps) aumentam MUITO o SEO e CTR. ${hasTimestamps ? 'Use os timestamps REAIS.' : 'Crie timestamps estimados.'} 
O YouTube usa as primeiras 2-3 linhas da descrição para ranking — otimize com keywords de alto volume.
Formato profissional, 250-500 palavras.`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: geminiHeaders,
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `SYSTEM: Você é um especialista em YouTube SEO com conhecimento profundo do algoritmo 2025-2026. Gere descrições que maximizam alcance, impressões e ranking. Use keywords de alto volume de busca e otimize cada linha para o algoritmo.\n\n${prompt}\n\nResponda APENAS em JSON válido com esta estrutura:\n{"description": "string", "hashtags": ["string"], "keywords": ["string"], "seo_score": number, "keyword_density_note": "string"}` }] },
          ],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini SEO error:", response.status, errText);
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const result = await response.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("No content in response");
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown type: ${type}`);
  } catch (e) {
    console.error("generate-titles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
