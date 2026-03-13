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
    const { topic, durationSeconds, style, niche, language, viralContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const dur = parseInt(durationSeconds) || 45;
    const wpm = 150; // avg speech rate
    const targetWords = Math.round((dur / 60) * wpm);

    // ========== Fetch SHORT-specific knowledge (parallel) ==========
    const [hookRes, psychRes, attRes, viralTitlesRes] = await Promise.all([
      sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false }).limit(10),
      sb.from("audience_psychology_patterns").select("trigger_type,description,example_hooks,retention_score")
        .order("retention_score", { ascending: false }).limit(6),
      sb.from("attention_engineering").select("pattern_name,technique,category,retention_impact,intensity_level")
        .order("retention_impact", { ascending: false }).limit(8),
      sb.from("viral_titles_db" as any).select("title,views,why_viral,title_pattern,niche")
        .order("views", { ascending: false }).limit(10),
    ]);

    const hookLibrary = (hookRes.data || []).map((r: any) =>
      `• [${r.hook_type}] "${r.hook_text}" (retenção: ${r.retention_score}/10)`
    ).join("\n");

    const psychTriggers = (psychRes.data || []).map((r: any) =>
      `• ${r.trigger_type}: ${r.description?.slice(0, 100)}`
    ).join("\n");

    const attEngineering = (attRes.data || []).map((r: any) =>
      `• ${r.pattern_name}: ${r.technique.slice(0, 120)} (impacto: ${r.retention_impact}%)`
    ).join("\n");

    const viralTitles = (viralTitlesRes.data || []).slice(0, 5).map((t: any) =>
      `• "${t.title}" (${(t.views || 0).toLocaleString()} views)`
    ).join("\n");

    const viralInjection = viralContext ? `\n🔥 ELEMENTOS VIRAIS:\n${viralContext}\n` : '';

    // ========== Style-specific SHORT instructions ==========
    const styleLC = (style || '').toLowerCase();
    const shortStyleGuides: Record<string, string> = {
      'dopaminérgico': 'Ritmo frenético, cada frase é um punch. Cortes mentais rápidos.',
      'cinematográfico': 'Micro-história visual em 3 atos comprimidos. Cada segundo conta.',
      'mrbeast': 'IMPOSSÍVEL ignorar. Desafio relâmpago. "Em 30 segundos..."',
      'storytelling': 'Mini-história: personagem + conflito + twist em <60s.',
      'narração': 'Voz hipnótica. Uma revelação por frase. Suspense comprimido.',
      'educativo': 'UM fato devastador. Destrua um mito em segundos.',
      'tutorial': 'Resultado PRIMEIRO. 3 passos máximo. "O hack que ninguém conta..."',
      'listicle': '3 items MAX. O último é CHOCANTE.',
      'reddit': 'Confissão rápida. "Eu nunca deveria ter..." — plot twist brutal.',
      'conspiração': 'Uma pergunta impossível. Evidência visual. "Eles não querem que você saiba..."',
      'mitologia': 'Momento épico de um mito. Batalha ou traição em segundos.',
      'teorias': 'Mistério comprimido. "E se eu te dissesse que..." — revelação.',
    };
    const selectedShortStyle = shortStyleGuides[styleLC] || shortStyleGuides['dopaminérgico'];

    const systemPrompt = `Você é o MELHOR ROTEIRISTA DE SHORTS DO MUNDO. 95%+ completion rate.

📱 FORMATO: YouTube Short / TikTok / Reels — VERTICAL 9:16
⏱️ DURAÇÃO: EXATAMENTE ${dur} segundos (~${targetWords} palavras)

🎯 ESTRUTURA OBRIGATÓRIA DE SHORT VIRAL:
1. HOOK (0-2s): Frase IMPOSSÍVEL de ignorar. Texto na tela + voz. Deve parar o scroll.
2. CURIOSITY (2-8s): Construa a lacuna de curiosidade. "Mas espera..."
3. REVEAL (8-${Math.round(dur * 0.6)}s): Entregue o conteúdo principal. Ritmo rápido.
4. TWIST (${Math.round(dur * 0.6)}-${Math.round(dur * 0.85)}s): Algo inesperado. Muda tudo.
5. LOOP ENDING (últimos 3-5s): O final CONECTA com o início. Espectador quer rever.

🎯 HOOKS REAIS DE ALTA PERFORMANCE:
${hookLibrary.slice(0, 1000)}

🧠 GATILHOS PSICOLÓGICOS:
${psychTriggers.slice(0, 600)}

⚡ TÉCNICAS DE ATENÇÃO:
${attEngineering.slice(0, 600)}

${viralTitles ? `🏆 TÍTULOS VIRAIS REFERÊNCIA:\n${viralTitles}\n` : ''}
${viralInjection}

📝 ESTILO: ${selectedShortStyle}
Nicho: ${niche || 'geral'} | Idioma: ${language || 'português'}

REGRAS ABSOLUTAS:
1. APENAS texto falado. ZERO anotações, timestamps, "Narrador:", "Cena:"
2. Frases CURTÍSSIMAS (máx 8 palavras por frase)
3. UMA ideia central. ZERO enrolação
4. Linguagem ULTRA coloquial e magnética
5. O FINAL deve criar desejo de rever (loop)
6. CADA segundo conta — sem palavras desperdiçadas

📝 NO FINAL, após "---SHORT_META---":
- 3 títulos virais para o Short
- 5 hashtags
- CTA sugerido
- Texto para overlay (3-5 frases de impacto para colocar na tela)
---END_SHORT_META---

⚠️ MÁXIMO ${targetWords + 15} palavras. Shorts NUNCA devem passar de ${dur}s.`;

    console.log(`Generating SHORT script: ${dur}s, ~${targetWords} words, style=${style}`);
    const res = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Escreva um SHORT VIRAL de ${dur}s sobre: "${topic}"\nAlvo: ${targetWords} palavras. Hook de CHOQUE em 2s. Loop ending. ROTEIRO LIMPO.\nComece!` }
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
