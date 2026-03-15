import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, durationSeconds, style, niche, language, viralContext, channelKnowledge } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const dur = parseInt(durationSeconds) || 45;
    const wpm = 150;
    const targetWords = Math.round((dur / 60) * wpm);

    // ═══════ FETCH SHORTS-SPECIFIC KNOWLEDGE (parallel) ═══════
    const [hookRes, psychRes, attRes, viralTitlesRes, contentModelRes, scenePatternRes] = await Promise.all([
      sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false }).limit(15),
      sb.from("audience_psychology_patterns").select("trigger_type,description,example_hooks,storytelling_pattern,retention_score")
        .order("retention_score", { ascending: false }).limit(8),
      sb.from("attention_engineering").select("pattern_name,technique,category,retention_impact,intensity_level,psychological_basis,trigger_second,duration_window_sec")
        .in("category", ["hook", "retention", "dopamine", "loop", "visual", "emotion", "urgência", "conexão"])
        .order("retention_impact", { ascending: false }).limit(12),
      sb.from("viral_titles_db" as any).select("title,views,why_viral,title_pattern,niche")
        .order("views", { ascending: false }).limit(8),
      sb.from("content_models").select("model_name,description,hook_pattern,pacing_guide,structure_json,retention_profile")
        .eq("video_type", "short")
        .order("effectiveness_score", { ascending: false }).limit(5),
      sb.from("attention_library").select("pattern_name,scene_type,emotion,attention_score,recovery_technique,time_window")
        .gte("attention_score", 7)
        .order("attention_score", { ascending: false }).limit(8),
    ]);

    // ═══════ BUILD KNOWLEDGE BLOCKS ═══════
    const hookLibrary = (hookRes.data || []).map((r: any) =>
      `• [${r.hook_type}] "${r.hook_text}" (retenção: ${r.retention_score}/10${r.niche ? ` | ${r.niche}` : ''})`
    ).join("\n");

    const psychTriggers = (psychRes.data || []).map((r: any) => {
      const hooks = Array.isArray(r.example_hooks) ? r.example_hooks.slice(0, 2).join('" / "') : '';
      return `• ${r.trigger_type.toUpperCase()}: ${r.description?.slice(0, 120)}${hooks ? ` → Ex: "${hooks}"` : ''}${r.storytelling_pattern ? ` | Padrão: ${r.storytelling_pattern}` : ''}`;
    }).join("\n");

    const attEngineering = (attRes.data || []).map((r: any) =>
      `• ${r.pattern_name} [${r.category}] (${r.trigger_second || 0}s, impacto: +${r.retention_impact}%): ${r.technique.slice(0, 150)}\n  Psicologia: ${(r.psychological_basis || '').slice(0, 100)}`
    ).join("\n");

    const viralTitles = (viralTitlesRes.data || []).slice(0, 5).map((t: any) =>
      `• "${t.title}" (${(t.views || 0).toLocaleString()} views) — ${t.why_viral || t.title_pattern || ''}`
    ).join("\n");

    const contentModels = (contentModelRes.data || []).map((m: any) => {
      const phases = Array.isArray(m.structure_json) ? m.structure_json.map((p: any) => `  ${p.phase} (${p.seconds}): ${p.action}`).join("\n") : '';
      return `📐 ${m.model_name}: ${m.description}\n  Hook: ${m.hook_pattern}\n  Pacing: ${m.pacing_guide}\n${phases}`;
    }).join("\n\n");

    const scenePatterns = (scenePatternRes.data || []).map((s: any) =>
      `• ${s.pattern_name} [${s.scene_type}] (${s.time_window}) — emoção: ${s.emotion}, score: ${s.attention_score}/10${s.recovery_technique ? ` | recovery: ${s.recovery_technique}` : ''}`
    ).join("\n");

    const viralInjection = viralContext ? `\n🔥 ELEMENTOS VIRAIS DO USUÁRIO:\n${viralContext}\n` : '';
    const channelBlock = channelKnowledge ? `\n📚 CONHECIMENTO DO CANAL:\n${channelKnowledge}\nAdapte o tom e estilo ao perfil deste canal.\n` : '';

    // ═══════ STYLE-SPECIFIC SHORT INSTRUCTIONS ═══════
    const styleLC = (style || '').toLowerCase();
    const shortStyleGuides: Record<string, string> = {
      'dopaminérgico': `MODO DOPAMINA MÁXIMA:
- Cada frase = 1 punch dopaminérgico. Zero frases de transição.
- Técnica "Dopamine Stacking": micro-revelação a cada 3s, cada uma mais intensa.
- Ritmo: pausa de 0.3s entre frases. Nunca mais que 6 palavras seguidas.
- Final: "E o pior de tudo..." → loop para o início.`,
      'cinematográfico': `MODO CINEMA COMPRIMIDO:
- Micro-história visual em 3 atos comprimidos. Cada segundo é um frame de filme.
- Descrições sensoriais densas: "O silêncio era tão pesado que..."
- Use flashforward nos primeiros 2s, depois volte ao início.
- Final épico que ressoa emocionalmente.`,
      'mrbeast': `MODO IMPOSSÍVEL DE IGNORAR:
- Energia 11/10 desde o segundo 0. "Em 30 SEGUNDOS eu vou..."
- Promessa ABSURDA + entrega. Stakes impossíveis.
- Contagem regressiva implícita. Urgência a cada frase.
- Desafio relâmpago com resultado CHOCANTE.`,
      'storytelling': `MODO MINI-HISTÓRIA:
- Personagem + conflito em 5s. Empatia instantânea.
- Cada frase avança a história. Zero descrição desnecessária.
- Plot twist nos últimos 8s que muda TUDO.
- Última frase ecoa na mente do espectador.`,
      'narração': `MODO NARRAÇÃO HIPNÓTICA:
- Tom confessional, como se contasse um segredo.
- Uma revelação por frase. Pausas estratégicas.
- Suspense comprimido ao máximo. "E foi aí que eu vi..."
- Voz que gruda no ouvido. Cada palavra é intencional.`,
      'educativo': `MODO DESTRUIDOR DE MITOS:
- UM fato devastador que muda perspectiva em 30s.
- "Tudo que te ensinaram sobre [X] está errado."
- Dado específico + analogia visual + implicação chocante.
- Final: "E sabe o que é pior?"`,
      'tutorial': `MODO HACK RELÂMPAGO:
- Resultado PRIMEIRO (nos primeiros 3s). Depois o método.
- Máximo 3 passos. Cada um com resultado visível.
- "O hack que ninguém conta..." → passo 1 → passo 2 → resultado.
- "Salva esse vídeo" como CTA implícito.`,
      'listicle': `MODO ESCALADA NUCLEAR:
- 3 items máximo. Cada um MAIS chocante que o anterior.
- "Número 3 vai te deixar sem dormir."
- Transição brusca entre items. Sem enrolação.
- O último item deve ser 3x mais impactante.`,
      'reddit': `MODO CONFISSÃO:
- "Eu nunca deveria ter..." — primeira pessoa.
- Tom vulnerável e autêntico. Detalhes que validam.
- Plot twist brutal que ninguém espera.
- "E o pior? Ninguém me acreditou."`,
      'conspiração': `MODO PROIBIDO:
- "Eles não querem que você saiba isso."
- Uma pergunta impossível + evidência visual forte.
- Escalada de revelações, cada uma mais perturbadora.
- "Se eu desaparecer... já sabe o motivo."`,
      'mitologia': `MODO ÉPICO COMPRIMIDO:
- Momento mais devastador de um mito em 30s.
- Batalha, traição ou sacrifício. Emoção máxima.
- Descrições grandiosas em frases curtas: "O céu se abriu."
- Final que conecta mito com lição atemporal.`,
      'teorias': `MODO MISTÉRIO RELÂMPAGO:
- "E se eu te dissesse que..." — semente de dúvida.
- 1 evidência → 1 contra-evidência → revelação final.
- Cada frase aumenta a incerteza. Espectador PRECISA saber.
- Loop: "Mas a verdade é ainda pior do que parece..."`,
    };
    const selectedShortStyle = shortStyleGuides[styleLC] || shortStyleGuides['dopaminérgico'];

    // ═══════ CHOOSE BEST CONTENT MODEL ═══════
    const bestModel = contentModelRes.data?.[0];
    const modelBlock = bestModel ? `\n📐 MODELO ESTRUTURAL RECOMENDADO: ${bestModel.model_name}\n${bestModel.description}\nHook: ${bestModel.hook_pattern}\nPacing: ${bestModel.pacing_guide}\n` : '';

    const systemPrompt = `Você é o MELHOR ROTEIRISTA DE SHORTS DO MUNDO. Taxa de conclusão: 95%+. Cada Short seu faz >1M views.

═══════════════════════════════════
📱 FORMATO: YouTube Short / TikTok / Reels — VERTICAL 9:16
⏱️ DURAÇÃO: EXATAMENTE ${dur} segundos (~${targetWords} palavras)
═══════════════════════════════════

🧬 CIÊNCIA DA ATENÇÃO PARA SHORTS:
Shorts competem contra o scroll infinito. Você tem 0.3 segundos para capturar atenção.
Cada segundo sem valor = espectador perdido PARA SEMPRE.

O cérebro humano em Shorts:
- 0-0.3s: Processamento pré-atencional (visual PRECISA ser diferente)
- 0.3-2s: Decisão de continuar ou scrollar (HOOK verbal é TUDO)
- 2-8s: Janela de curiosidade (GAP deve ser ABERTO aqui)
- 8s+: Pattern interrupt OBRIGATÓRIO a cada 6-8s
- Últimos 5s: Loop ending cria compulsão de rever

═══════════════════════════════════
🎯 ESTRUTURA NEURAL-OTIMIZADA:
═══════════════════════════════════
1. SCROLL STOPPER (0-0.3s): Visual + texto na tela que PARA o dedo
2. VERBAL HOOK (0.3-2s): Frase IMPOSSÍVEL de ignorar. Máx 8 palavras.
3. CURIOSITY GAP (2-5s): Abra um loop que SÓ fecha no final
4. DOPAMINE STACK (5-${Math.round(dur * 0.6)}s): Micro-revelações a cada 3-5s, ESCALANDO
5. EMOTIONAL PEAK (${Math.round(dur * 0.6)}-${Math.round(dur * 0.85)}s): Twist/Revelação/Choque
6. LOOP MAGNET (últimos 3-5s): Final que CONECTA ao início → >200% watch time
${modelBlock}
═══════════════════════════════════
🎣 HOOKS REAIS DE ALTA PERFORMANCE (use como inspiração):
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

${scenePatterns ? `═══════════════════════════════════\n🎬 PADRÕES DE CENA DE ALTA ATENÇÃO:\n═══════════════════════════════════\n${scenePatterns}\n` : ''}

${viralTitles ? `═══════════════════════════════════\n🏆 TÍTULOS VIRAIS REFERÊNCIA:\n═══════════════════════════════════\n${viralTitles}\n` : ''}
${viralInjection}
${channelBlock}
═══════════════════════════════════
🎭 ESTILO ESPECÍFICO:
═══════════════════════════════════
${selectedShortStyle}

Nicho: ${niche || 'geral'} | Idioma: ${language || 'português'}

═══════════════════════════════════
⚠️ REGRAS ABSOLUTAS (violação = roteiro rejeitado):
═══════════════════════════════════
1. APENAS texto falado. ZERO: timestamps, "Narrador:", "Cena:", indicações
2. Frases CURTÍSSIMAS: máximo 6-8 palavras por frase
3. UMA ideia central. ZERO enrolação. Cada palavra PAGA seu espaço
4. Linguagem MAGNÉTICA: coloquial mas poderosa. Sem ser formal
5. LOOP ENDING obrigatório: últimas palavras → primeiras palavras
6. Pattern interrupt VISUAL a cada 8s (indique com [CORTE])
7. MÁXIMO ${targetWords + 10} palavras. NUNCA passe de ${dur}s

═══════════════════════════════════
📝 APÓS O ROTEIRO, inclua exatamente:
═══════════════════════════════════
---SHORT_META---
TÍTULOS (3 opções virais):
1. [título 1]
2. [título 2]  
3. [título 3]

HASHTAGS: #tag1 #tag2 #tag3 #tag4 #tag5

CTA: [call to action sugerido]

OVERLAY (frases para tela):
- [frase impacto 1]
- [frase impacto 2]
- [frase impacto 3]

LOOP SCORE: [0-10 quão bem o final conecta ao início]
DOPAMINE SCORE: [0-10 densidade de micro-recompensas]
HOOK SCORE: [0-10 força do hook de 2 segundos]
---END_SHORT_META---`;

    console.log(`Generating SHORT script: ${dur}s, ~${targetWords} words, style=${style}, niche=${niche}`);
    const res = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Escreva um SHORT VIRAL de ${dur}s sobre: "${topic}"\n\nAlvo: ${targetWords} palavras.\nHook de CHOQUE em 0.3s.\nDopamine stacking a cada 3-5s.\nLoop ending obrigatório.\nCada palavra deve MERECER estar no roteiro.\n\nComece IMEDIATAMENTE com o hook — sem preâmbulos!` }
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
