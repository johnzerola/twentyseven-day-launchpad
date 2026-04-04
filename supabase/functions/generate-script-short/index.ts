import { callGeminiStreaming } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, durationSeconds, style, niche, language, viralContext, channelKnowledge, durationCategory } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const dur = parseInt(durationSeconds) || 45;
    const wpm = 150;
    const targetWords = Math.round((dur / 60) * wpm);

    // ═══ DETERMINE DURATION CATEGORY ═══
    const durCat = durationCategory || (dur <= 25 ? 'micro' : dur <= 40 ? 'flash' : 'story');

    // ═══ FETCH SHORTS-SPECIFIC KNOWLEDGE (parallel) ═══
    const [hookRes, psychRes, attRes, viralTitlesRes, contentModelRes, scenePatternRes, shortsKnowledgeRes, monetizationRes] = await Promise.all([
      sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false }).limit(15),
      sb.from("audience_psychology_patterns").select("trigger_type,description,example_hooks,storytelling_pattern,retention_score")
        .order("retention_score", { ascending: false }).limit(8),
      sb.from("attention_engineering").select("pattern_name,technique,category,retention_impact,intensity_level,psychological_basis,trigger_second,duration_window_sec")
        .in("category", ["hook", "retention", "dopamine", "loop", "visual", "emotion", "urgência", "conexão"])
        .order("retention_impact", { ascending: false }).limit(12),
      sb.from("viral_titles_db" as any).select("title,views,why_viral,title_pattern,niche")
        .order("views", { ascending: false }).limit(8),
      sb.from("content_models").select("model_name,description,hook_pattern,pacing_guide,structure_json,retention_profile,best_for_duration")
        .eq("video_type", "short")
        .order("effectiveness_score", { ascending: false }).limit(8),
      sb.from("attention_library").select("pattern_name,scene_type,emotion,attention_score,recovery_technique,time_window")
        .gte("attention_score", 7)
        .order("attention_score", { ascending: false }).limit(8),
      sb.from("youtube_knowledge").select("title,content")
        .ilike("title", "%shorts%")
        .order("priority", { ascending: false }).limit(3),
      sb.from("youtube_knowledge").select("title,content")
        .eq("category", "shorts-monetization")
        .order("priority", { ascending: false }).limit(3),
    ]);

    // ═══ BUILD KNOWLEDGE BLOCKS ═══
    const hookLibrary = (hookRes.data || []).map((r: any) =>
      `• [${r.hook_type}] "${r.hook_text}" (retenção: ${r.retention_score}/10${r.niche ? ` | ${r.niche}` : ''})`
    ).join("\n");

    const psychTriggers = (psychRes.data || []).map((r: any) => {
      const hooks = Array.isArray(r.example_hooks) ? r.example_hooks.slice(0, 2).join('" / "') : '';
      return `• ${r.trigger_type.toUpperCase()}: ${r.description?.slice(0, 120)}${hooks ? ` → Ex: "${hooks}"` : ''}${r.storytelling_pattern ? ` | Padrão: ${r.storytelling_pattern}` : ''}`;
    }).join("\n");

    const attEngineering = (attRes.data || []).map((r: any) =>
      `• ${r.pattern_name} [${r.category}] (${r.trigger_second || 0}s, impacto: +${r.retention_impact}%): ${r.technique.slice(0, 150)}`
    ).join("\n");

    const viralTitles = (viralTitlesRes.data || []).slice(0, 5).map((t: any) =>
      `• "${t.title}" (${(t.views || 0).toLocaleString()} views) — ${t.why_viral || t.title_pattern || ''}`
    ).join("\n");

    // ═══ SELECT BEST MODEL FOR DURATION ═══
    const allModels = contentModelRes.data || [];
    const bestModel = allModels.find((m: any) => {
      const bf = (m.best_for_duration || '').toLowerCase();
      if (durCat === 'micro' && bf.includes('15')) return true;
      if (durCat === 'flash' && (bf.includes('25') || bf.includes('30'))) return true;
      if (durCat === 'story' && (bf.includes('45') || bf.includes('50') || bf.includes('60'))) return true;
      return false;
    }) || allModels[0];

    const contentModels = allModels.map((m: any) => {
      const phases = Array.isArray(m.structure_json) ? m.structure_json.map((p: any) => `  ${p.phase} (${p.seconds}): ${p.action}`).join("\n") : '';
      const selected = m === bestModel ? ' ⭐ RECOMENDADO' : '';
      return `📐 ${m.model_name} (${m.best_for_duration})${selected}:\n  ${m.description}\n  Hook: ${m.hook_pattern}\n  Pacing: ${m.pacing_guide}\n${phases}`;
    }).join("\n\n");

    const scenePatterns = (scenePatternRes.data || []).map((s: any) =>
      `• ${s.pattern_name} [${s.scene_type}] (${s.time_window}) — emoção: ${s.emotion}, score: ${s.attention_score}/10`
    ).join("\n");

    const shortsKnowledge = (shortsKnowledgeRes.data || []).map((k: any) =>
      `${k.title}: ${k.content?.slice(0, 300)}`
    ).join("\n\n");

    const monetizationKnowledge = (monetizationRes.data || []).map((k: any) =>
      `${k.title}: ${k.content?.slice(0, 400)}`
    ).join("\n\n");

    const viralInjection = viralContext ? `\n🔥 ELEMENTOS VIRAIS:\n${viralContext}\n` : '';
    const channelBlock = channelKnowledge ? `\n📚 CONHECIMENTO DO CANAL:\n${channelKnowledge}\nAdapte o tom e estilo ao perfil deste canal.\n` : '';

    // ═══ DURATION-SPECIFIC STRATEGY ═══
    const durationStrategies: Record<string, string> = {
      micro: `🎯 MODO MICRO-SHORT (15-25s) — COMPLETION RATE MÁXIMO
OBJETIVO: >95% de completion. UMA ideia nuclear. ZERO gordura.
- Cada segundo = 1 punch dopaminérgico. Sem transições, sem buildup longo.
- Hook em 0.3s + conteúdo denso + loop em 3s finais.
- Pense: "Qual é o FATO ÚNICO mais chocante sobre esse tema?"
- Se pode ser dito em 15s, NÃO use 25s. Brevidade = viralização.
- DADO: Shorts de 15-25s têm 40% mais chance de entrar no feed "For You".`,

      flash: `🎯 MODO FLASH-SHORT (25-40s) — SWEET SPOT DO ALGORITMO
OBJETIVO: >88% de completion. Fato + contexto + twist.
- Hook (2s) → Setup rápido (5s) → 2-3 revelações escalando (15s) → Twist (5s) → Loop (3s)
- Permite um arco narrativo MÍNIMO: apresentar → escalar → surpreender.
- Pattern interrupt a cada 8s para manter atenção.
- Ideal para: "3 coisas que...", revelações com buildup, hacks com demonstração.`,

      story: `🎯 MODO STORY-SHORT (45-60s) — NARRATIVA EMOCIONAL
OBJETIVO: >78% de completion. A história JUSTIFICA cada segundo.
- Flashforward (3s) → Setup personagem (10s) → Jornada (15s) → Escalada (10s) → Twist devastador (7s) → Loop emocional (5s)
- SÓ funciona com temas de ALTO valor emocional: milionários, crime, tragédia, superação.
- Precisa de retention engineering a cada 8s: pattern interrupt, revelação, mudança de tom.
- Se o tema NÃO precisa de 45-60s, ENCURTE. Nunca estique conteúdo fraco.
- CASE: Canais de história com shorts de 48s médios atingem 500K+ com storytelling comprimido.`,
    };

    const durationStrategy = durationStrategies[durCat] || durationStrategies.flash;

    // ═══ STYLE-SPECIFIC SHORT INSTRUCTIONS ═══
    const styleLC = (style || '').toLowerCase();
    const shortStyleGuides: Record<string, string> = {
      'dopaminérgico': `MODO DOPAMINA MÁXIMA:\n- Cada frase = 1 punch dopaminérgico. Zero frases de transição.\n- Técnica "Dopamine Stacking": micro-revelação a cada 3s, cada uma mais intensa.\n- Ritmo: pausa de 0.3s entre frases. Nunca mais que 6 palavras seguidas.\n- Final: "E o pior de tudo..." → loop para o início.`,
      'cinematográfico': `MODO CINEMA COMPRIMIDO:\n- Micro-história visual em 3 atos. Cada segundo é um frame de filme.\n- Descrições sensoriais densas: "O silêncio era tão pesado que..."\n- Flashforward nos primeiros 2s, depois volte ao início.\n- Final épico que ressoa emocionalmente.`,
      'mrbeast': `MODO IMPOSSÍVEL DE IGNORAR:\n- Energia 11/10 desde o segundo 0. "Em 30 SEGUNDOS eu vou..."\n- Promessa ABSURDA + entrega. Stakes impossíveis.\n- Contagem regressiva implícita. Urgência a cada frase.`,
      'storytelling': `MODO MINI-HISTÓRIA:\n- Personagem + conflito em 5s. Empatia instantânea.\n- Cada frase avança a história. Zero descrição desnecessária.\n- Plot twist nos últimos 8s que muda TUDO.`,
      'narração': `MODO NARRAÇÃO HIPNÓTICA:\n- Tom confessional, como se contasse um segredo.\n- Uma revelação por frase. Pausas estratégicas.\n- Suspense comprimido ao máximo.`,
      'educativo': `MODO DESTRUIDOR DE MITOS:\n- UM fato devastador que muda perspectiva.\n- "Tudo que te ensinaram sobre [X] está errado."\n- Dado específico + analogia visual + implicação chocante.`,
      'tutorial': `MODO HACK RELÂMPAGO:\n- Resultado PRIMEIRO (3s). Depois o método.\n- Máximo 3 passos. Cada um com resultado visível.`,
      'listicle': `MODO ESCALADA NUCLEAR:\n- 3 items máximo. Cada um MAIS chocante.\n- "Número 3 vai te deixar sem dormir."\n- O último item 3x mais impactante.`,
      'reddit': `MODO CONFISSÃO:\n- "Eu nunca deveria ter..." — primeira pessoa.\n- Tom vulnerável e autêntico.\n- Plot twist brutal que ninguém espera.`,
      'conspiração': `MODO PROIBIDO:\n- "Eles não querem que você saiba isso."\n- Escalada de revelações, cada uma mais perturbadora.`,
      'mitologia': `MODO ÉPICO COMPRIMIDO:\n- Momento mais devastador de um mito em ${dur}s.\n- Batalha, traição ou sacrifício. Emoção máxima.`,
      'teorias': `MODO MISTÉRIO RELÂMPAGO:\n- "E se eu te dissesse que..." — semente de dúvida.\n- 1 evidência → 1 contra-evidência → revelação final.`,
    };
    const selectedShortStyle = shortStyleGuides[styleLC] || shortStyleGuides['dopaminérgico'];

    const modelBlock = bestModel ? `\n📐 MODELO ESTRUTURAL RECOMENDADO: ${bestModel.model_name} (${bestModel.best_for_duration})\n${bestModel.description}\nHook: ${bestModel.hook_pattern}\nPacing: ${bestModel.pacing_guide}\n` : '';

    const systemPrompt = `Você é o MELHOR ROTEIRISTA DE SHORTS DO MUNDO. Taxa de conclusão: 95%+. Cada Short seu faz >1M views.

═══════════════════════════════════
📱 FORMATO: YouTube Short / TikTok / Reels — VERTICAL 9:16
⏱️ DURAÇÃO: EXATAMENTE ${dur} segundos (~${targetWords} palavras)
📊 CATEGORIA: ${durCat.toUpperCase()} SHORT
═══════════════════════════════════

${durationStrategy}

🧬 CIÊNCIA DA ATENÇÃO PARA SHORTS:
${shortsKnowledge}

💰 INTELIGÊNCIA DE MONETIZAÇÃO:
${monetizationKnowledge}
DADOS REAIS DE CRIADORES (2025):
- Shorts de 1.5-3 min geram MAIS views que shorts de 30s (AVD absoluto maior)
- ~$100 por 1M views em shorts (RPM $0.10-$0.20 dependendo do nicho)
- Criador fez $750 em 30 dias com shorts de 2-3min (7.2M views)
- Shorts gaming/entertainment = $0.17-0.18 RPM
- Shorts finanças/dropshipping = $0.25-0.30 RPM
- Estratégia validada: 70% micro-shorts (15-25s) para viralizar + 30% story-shorts (45-60s+) para watch time
- HACK VALIDADO: Efeito sonoro de meme nos primeiros 0.5s aumenta swipe ratio de 77% para 82%+
- VIDEO BREATHING: Não spame uploads. 2-3 shorts/dia com intervalos > 6 shorts seguidos

REGRA DO SNOWBALL: Canais explodem exponencialmente, não linearmente:
- Dias 1-7: Slow start (1K-10K views/dia) 
- Dias 8-15: Descoberta de formato viral
- Dias 15-30: Efeito bola de neve (50K-500K+ views/dia)

O cérebro humano em Shorts:
- 0-0.3s: Processamento pré-atencional (visual PRECISA ser diferente)
- 0.3-2s: Decisão de continuar ou scrollar (HOOK verbal é TUDO)
- 2-8s: Janela de curiosidade (GAP deve ser ABERTO aqui)
- 8s+: Pattern interrupt OBRIGATÓRIO a cada 6-8s
- Últimos 5s: Loop ending cria compulsão de rever

═══════════════════════════════════
🎯 ESTRUTURA NEURAL-OTIMIZADA:
═══════════════════════════════════
${durCat === 'micro' ? `1. SCROLL STOPPER (0-0.3s): Visual + texto na tela que PARA o dedo
2. VERBAL HOOK (0.3-2s): Frase IMPOSSÍVEL de ignorar. Máx 5 palavras.
3. NUCLEAR CONTENT (2-${dur - 3}s): Informação densa, cada frase é explosão dopaminérgica
4. LOOP MAGNET (últimos 3s): Final que CONECTA ao início → >200% watch time`
: durCat === 'flash' ? `1. SCROLL STOPPER (0-0.3s): Visual + texto na tela
2. VERBAL HOOK (0.3-2s): Frase IMPOSSÍVEL de ignorar. Máx 8 palavras.
3. CONTEXT (2-7s): Setup mínimo: quem/quando/onde
4. ESCALATION (7-${Math.round(dur * 0.7)}s): Micro-revelações escalando
5. TWIST (${Math.round(dur * 0.7)}-${Math.round(dur * 0.85)}s): Informação que inverte tudo
6. LOOP MAGNET (últimos 3-5s): Final → início`
: `1. FLASHFORWARD (0-3s): Resultado dramático ANTES da história
2. VERBAL HOOK (3-5s): "Essa é a história de..."
3. ORIGIN (5-13s): Personagem + situação + empatia
4. JOURNEY (13-28s): Ascensão ou queda com detalhes específicos
5. PEAK (28-${Math.round(dur * 0.8)}s): Máxima tensão, stakes impossíveis
6. DEVASTATION (${Math.round(dur * 0.8)}-${Math.round(dur * 0.9)}s): Twist devastador
7. ECHO LOOP (últimos 5s): Frase que conecta ao flashforward`}
${modelBlock}
═══════════════════════════════════
🎣 HOOKS REAIS DE ALTA PERFORMANCE:
═══════════════════════════════════
${hookLibrary}

═══════════════════════════════════
🧠 GATILHOS PSICOLÓGICOS VALIDADOS:
═══════════════════════════════════
${psychTriggers}

═══════════════════════════════════
⚡ TÉCNICAS DE ENGENHARIA DE ATENÇÃO:
═══════════════════════════════════
${attEngineering}

${scenePatterns ? `═══════════════════════════════════\n🎬 PADRÕES DE CENA:\n═══════════════════════════════════\n${scenePatterns}\n` : ''}
${viralTitles ? `═══════════════════════════════════\n🏆 TÍTULOS VIRAIS REFERÊNCIA:\n═══════════════════════════════════\n${viralTitles}\n` : ''}
${viralInjection}
${channelBlock}
═══════════════════════════════════
🎭 ESTILO ESPECÍFICO:
═══════════════════════════════════
${selectedShortStyle}

Nicho: ${niche || 'geral'} | Idioma: ${language || 'português'}

═══════════════════════════════════
📢 MÉTODO 2CTA — MAXIMIZAR INSCRITOS SEM PERDER RETENÇÃO:
═══════════════════════════════════
Integre OBRIGATORIAMENTE 2 CTAs no roteiro:

CTA1 — VCTA (Visual CTA) → No primeiro terço do vídeo:
- SUTIL, integrado à cena. NÃO peça verbalmente.
- Exemplos: personagem segurando placa "Subscribe", texto no cenário, popup discreto.
- Marque no roteiro com [VCTA: descrição do visual]

CTA2 — VACTA (Visual+Audio CTA) → No momento de MAIOR TENSÃO, ANTES do payoff:
- Integrado com a narrativa. NUNCA pare o vídeo.
- Formato: "Subscribe se acha que [X vai acontecer]" 
- Use tensão emocional para manter a retenção DURANTE o CTA.
- Marque no roteiro com [VACTA: "frase do CTA"]
- Exemplos: "Subscribe se acha que ele vai sobreviver", "Subscribe se isso te chocou"

RESULTADO ESPERADO: Retenção RETA (sem dip) + máximo de inscritos.
Canais que usam 2CTA crescem de 0 a 200K subs em 20 dias.

═══════════════════════════════════
⚠️ REGRAS ABSOLUTAS:
═══════════════════════════════════
1. APENAS texto falado + marcações [VCTA] e [VACTA]. ZERO timestamps, "Narrador:", "Cena:"
2. Frases CURTÍSSIMAS: máximo 6-8 palavras por frase
3. UMA ideia central. ZERO enrolação. Cada palavra PAGA seu espaço
4. Linguagem MAGNÉTICA: coloquial mas poderosa
5. LOOP ENDING obrigatório: últimas palavras → primeiras palavras
6. Pattern interrupt VISUAL a cada 8s (indique com [CORTE])
7. MÁXIMO ${targetWords + 10} palavras. NUNCA passe de ${dur}s
8. Texto overlay: inclua 3 frases de impacto para colocar na tela
9. VCTA no primeiro terço, VACTA no momento de maior tensão

═══════════════════════════════════
📝 APÓS O ROTEIRO, inclua:
═══════════════════════════════════
---SHORT_META---
TÍTULOS (3 opções virais):
1. [título 1]
2. [título 2]
3. [título 3]

HASHTAGS: #tag1 #tag2 #tag3 #tag4 #tag5

VCTA: [descrição do visual CTA sutil integrado à cena]
VACTA: [frase do CTA verbal durante tensão emocional]

OVERLAY (frases para tela):
- [frase impacto 1]
- [frase impacto 2]
- [frase impacto 3]

LOOP SCORE: [0-10]
DOPAMINE SCORE: [0-10]
HOOK SCORE: [0-10]
COMPLETION ESTIMATE: [%]
DURATION CATEGORY: ${durCat}
---END_SHORT_META---`;

    console.log(`Generating SHORT: ${dur}s (~${targetWords}w), cat=${durCat}, style=${style}, niche=${niche}`);
    const res = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Escreva um ${durCat.toUpperCase()} SHORT VIRAL de ${dur}s sobre: "${topic}"\n\nAlvo: ${targetWords} palavras.\n${durCat === 'micro' ? 'Cada segundo = informação nova. ZERO gordura.' : durCat === 'story' ? 'Conte uma HISTÓRIA com personagem real, conflito e twist devastador.' : 'Fato surpreendente + buildup + twist.'}\nHook de CHOQUE em 0.3s.\nLoop ending obrigatório.\n\nComece IMEDIATAMENTE com o hook!` }
        ],
        stream: true,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return errResp("Rate limit. Tente novamente.", 429);
      if (res.status === 402) return errResp("Créditos insuficientes.", 402);
      const t = await res.text();
      console.error("Short script error:", res.status, t);
      throw new Error("Short script generation failed");
    }

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("generate-script-short error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
