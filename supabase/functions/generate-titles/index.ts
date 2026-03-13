import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type = "generate" } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const headers = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

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

    // ========== GENERATE TITLES ==========
    if (type === "generate") {
      const { niche, topic, language, country, scriptContext } = body;

      // Script context block (when coming from script pipeline)
      let scriptContextBlock = '';
      if (scriptContext) {
        scriptContextBlock = `\n\n📹 CONTEXTO COMPLETO DO VÍDEO (use para criar títulos PRECISOS que refletem o conteúdo real):\n${scriptContext}\n\nOs títulos DEVEM refletir o conteúdo acima. Não invente — extraia os ângulos mais clicáveis do roteiro real.`;
      }

      // 1) Fetch ALL knowledge sources in parallel
      let viralRefBlock = '';
      let psychologyBlock = '';
      let formatsBlock = '';
      let hooksBlock = '';
      let dynamicPatternsBlock = '';
      let learningBlock = '';

      try {
        // Build viral titles query — up to 80 most relevant refs (not just 30)
        let titlesQuery = sb.from('viral_titles_db')
          .select('title,views,why_viral,title_pattern,niche,language,emotional_triggers')
          .order('views', { ascending: false })
          .limit(80);

        // Filter by language if provided
        if (language) titlesQuery = titlesQuery.eq('language', language);
        // Filter by niche if provided
        if (niche) titlesQuery = titlesQuery.ilike('niche', `%${niche}%`);

        // Hooks query — filter by niche if relevant
        let hooksQuery = sb.from('hook_library')
          .select('hook_text,hook_type,retention_score,niche')
          .order('retention_score', { ascending: false })
          .limit(25);
        if (niche) hooksQuery = hooksQuery.or(`niche.ilike.%${niche}%,niche.is.null`);

        const [titlesRes, triggersRes, formatsRes, psychPatternsRes, hooksRes, patternsRes, learningRes] = await Promise.all([
          titlesQuery,
          sb.from('viral_content_library').select('content_json,effectiveness_score').eq('category', 'psychology_triggers').order('effectiveness_score', { ascending: false }).limit(10),
          sb.from('viral_content_library').select('content_json,effectiveness_score').eq('category', 'content_format').order('effectiveness_score', { ascending: false }).limit(8),
          sb.from('audience_psychology_patterns').select('trigger_type,description,example_titles,retention_score').order('retention_score', { ascending: false }).limit(10),
          hooksRes ?? hooksQuery,
          // Dynamic patterns: extract unique title_pattern values from DB
          sb.from('viral_titles_db').select('title_pattern').not('title_pattern', 'is', null).limit(500),
          // Previous user learning
          sb.from('ai_learning').select('insight').eq('topic', 'title_chosen').order('created_at', { ascending: false }).limit(15),
        ]);

        // --- Viral titles refs (up to 80) ---
        const viralTitles = titlesRes.data;
        if (viralTitles?.length) {
          viralRefBlock = `\n\nTÍTULOS VIRAIS REAIS DE REFERÊNCIA (${viralTitles.length} títulos comprovados):\n${viralTitles.map((t: any) => `• "${t.title}" (${t.views?.toLocaleString()} views) — Pattern: ${t.title_pattern || '?'} | Why: ${t.why_viral || 'N/A'} | Triggers: ${(t.emotional_triggers || []).join(', ')}`).join('\n')}\n\nAplique as mesmas técnicas. Não copie, adapte.`;
        }

        // --- Dynamic patterns from real data (not hardcoded 6!) ---
        const allPatterns = patternsRes.data;
        if (allPatterns?.length) {
          const uniquePatterns = [...new Set(allPatterns.map((p: any) => p.title_pattern?.toLowerCase()).filter(Boolean))];
          if (uniquePatterns.length > 0) {
            dynamicPatternsBlock = `\n\n🎯 PADRÕES DE TÍTULO REAIS EXTRAÍDOS DA BASE (${uniquePatterns.length} padrões únicos):\n${uniquePatterns.map(p => `• ${p}`).join('\n')}\n\nUse ESTES padrões reais como estilos. Distribua os 20 títulos entre vários padrões.`;
          }
        }

        // --- Hooks library ---
        const hooks = hooksRes.data;
        if (hooks?.length) {
          hooksBlock = `\n\n🔥 HOOKS VIRAIS COMPROVADOS (use como inspiração para início dos títulos):\n${hooks.map((h: any) => `• [${h.hook_type}] "${h.hook_text}" (retenção: ${h.retention_score}/10)`).join('\n')}`;
        }

        // --- Psychology triggers ---
        const triggers = triggersRes.data;
        if (triggers?.length) {
          psychologyBlock = `\n\n🧠 GATILHOS PSICOLÓGICOS (aplique nos títulos):\n${triggers.map((t: any) => {
            const c = t.content_json;
            return `• ${c.name || c.trigger}: ${c.description || c.tip || ''} (score: ${t.effectiveness_score}/10)`;
          }).join('\n')}`;
        }

        // --- Content formats ---
        const formats = formatsRes.data;
        if (formats?.length) {
          formatsBlock = `\n\n🎬 FORMATOS DE CONTEÚDO VIRAL:\n${formats.map((f: any) => {
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

        // --- Learning from user choices ---
        const learnings = learningRes.data;
        if (learnings?.length) {
          const parsed = learnings.map((l: any) => { try { return JSON.parse(l.insight); } catch { return null; } }).filter(Boolean);
          if (parsed.length) {
            const preferredStyles = parsed.map((p: any) => p.style).filter(Boolean);
            const styleCounts: Record<string, number> = {};
            preferredStyles.forEach((s: string) => { styleCounts[s] = (styleCounts[s] || 0) + 1; });
            const topStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
            learningBlock = `\n\n📊 PREFERÊNCIAS DO USUÁRIO (baseado em escolhas anteriores):\n• Estilos preferidos: ${topStyles.map(([s, c]) => `${s} (${c}x)`).join(', ')}\n• Títulos que o usuário gostou: ${parsed.slice(0, 5).map((p: any) => `"${p.title}"`).join(', ')}\nPriorize estes estilos mas mantenha diversidade.`;
          }
        }
      } catch { /* knowledge sources optional */ }

      // Language/country context
      const langContext = language ? `\nIdioma do título: ${language}` : '';
      const countryContext = country ? `\nPaís alvo: ${country}` : '';

      const prompt = `Gere exatamente 20 títulos virais para YouTube com CTR potencial de 15-30%.
${niche ? `Nicho: ${niche}` : ''}
${topic ? `Tema específico: ${topic}` : ''}${langContext}${countryContext}
${viralRefBlock}
${dynamicPatternsBlock}
${hooksBlock}
${psychologyBlock}
${formatsBlock}
${learningBlock}
${scriptContextBlock}

REGRAS PARA CTR MÁXIMO:
1. Cada título deve ter entre 45-65 caracteres (sweet spot para YouTube)
2. Use números ímpares quando aplicável (7, 13, 21 performam melhor)
3. Comece com a palavra mais impactante — a primeira palavra define o clique
4. Misture MAIÚSCULAS estrategicamente (max 2-3 palavras) para destacar
5. Crie curiosity gaps: o título DEVE fazer o viewer PRECISAR saber mais
6. Use contraste emocional: "A verdade LINDA sobre [coisa terrível]"
7. Evite clickbait puro — prometa algo que o vídeo entrega
8. Adapte ao idioma/cultura do público-alvo${language ? ` (${language})` : ''}
9. Cada título deve usar um padrão/estilo DIFERENTE — máxima diversidade
10. Integre hooks comprovados da biblioteca nos inícios dos títulos

Para cada título, classifique o estilo (use os padrões reais da base, não apenas 6 fixos) e estime o CTR de 5 a 30%.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é o maior especialista mundial em YouTube CTR optimization. Seus títulos consistentemente alcançam 15-30% de CTR. Você conhece todos os padrões psicológicos que fazem as pessoas clicarem compulsivamente. Pense como MrBeast, VeeFriends e os melhores criadores do mundo." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_titles",
              description: "Return viral title suggestions with dynamic styles",
              parameters: {
                type: "object",
                properties: {
                  titles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        style: { type: "string", description: "Dynamic style/pattern name from the real database patterns" },
                        estimatedCTR: { type: "number", description: "Estimated CTR between 5 and 30" },
                        hook_used: { type: "string", description: "Which hook technique was applied" },
                        psychological_trigger: { type: "string", description: "Primary psychological trigger used" },
                      },
                      required: ["title", "style", "estimatedCTR"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["titles"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_titles" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call response");
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ titles: parsed.titles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== A/B TEST ==========
    if (type === "ab-test") {
      const { titleA, titleB, language } = body;
      const langNote = language ? `\nIdioma dos títulos: ${language}. Analise considerando o público deste idioma.` : '';
      const prompt = `Analise estes 2 títulos de YouTube e determine qual performaria melhor:

Título A: "${titleA}"
Título B: "${titleB}"${langNote}

Analise: CTR estimado (5-30%), gatilhos emocionais usados, SEO score (1-10), score de comprimento (1-10, ideal 50-65 chars), e uma análise comparativa detalhada de 2-3 frases explicando por que o vencedor é melhor.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um especialista em YouTube analytics e CTR optimization." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_ab_result",
              description: "Return A/B test comparison result",
              parameters: {
                type: "object",
                properties: {
                  winner: { type: "string", enum: ["A", "B"] },
                  titleA: {
                    type: "object",
                    properties: {
                      ctr: { type: "number" },
                      emotionalTriggers: { type: "array", items: { type: "string" } },
                      seoScore: { type: "number" },
                      lengthScore: { type: "number" },
                    },
                    required: ["ctr", "emotionalTriggers", "seoScore", "lengthScore"],
                    additionalProperties: false,
                  },
                  titleB: {
                    type: "object",
                    properties: {
                      ctr: { type: "number" },
                      emotionalTriggers: { type: "array", items: { type: "string" } },
                      seoScore: { type: "number" },
                      lengthScore: { type: "number" },
                    },
                    required: ["ctr", "emotionalTriggers", "seoScore", "lengthScore"],
                    additionalProperties: false,
                  },
                  analysis: { type: "string" },
                },
                required: ["winner", "titleA", "titleB", "analysis"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_ab_result" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call response");
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== SEO DESCRIPTION ==========
    if (type === "seo-description") {
      const { title, niche, language, scriptContext } = body;
      const langNote = language ? `\nIdioma: ${language}. Escreva a descrição neste idioma.` : '';
      const hasTimestamps = scriptContext && scriptContext.includes('[');
      const scriptNote = scriptContext ? `\n\nCONTEXTO DO VÍDEO COM TRANSCRIÇÃO TIMESTAMPED (use para SEO e capítulos REAIS):\n${scriptContext}` : '';
      const prompt = `Gere uma descrição SEO completa e otimizada para um vídeo do YouTube com o título: "${title}"
${niche ? `Nicho: ${niche}` : ''}${langNote}${scriptNote}

A descrição deve incluir:
1. Primeira linha: keyword principal + benefício (aparece no search)
2. Parágrafo de contexto (2-3 linhas)
3. ${hasTimestamps ? 'Timestamps/capítulos REAIS baseados na transcrição acima — use os timestamps [MM:SS] da transcrição para criar capítulos que refletem o conteúdo real de cada momento do vídeo. Comece com 00:00 Introdução.' : 'Timestamps/capítulos sugeridos (00:00 formato)'}
4. Links placeholder para redes sociais
5. 3 hashtags relevantes
6. 8-12 keywords SEO extraídas do conteúdo real do vídeo

IMPORTANTE sobre timestamps: Os capítulos do YouTube (timestamps na descrição) aumentam MUITO o SEO e CTR. ${hasTimestamps ? 'Use os timestamps REAIS da transcrição para criar capítulos precisos. Agrupe cenas relacionadas em capítulos de 1-3 minutos.' : 'Crie timestamps estimados baseados no conteúdo.'}

Formato profissional, 200-400 palavras.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um especialista em YouTube SEO. Gere descrições otimizadas para máximo alcance." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_seo_description",
              description: "Return SEO optimized description",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  keywords: { type: "array", items: { type: "string" } },
                },
                required: ["description", "hashtags", "keywords"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_seo_description" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call response");
      const parsed = JSON.parse(toolCall.function.arguments);
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
