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
    const { draft_script, niche, language, duration, style, target_words } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!draft_script) throw new Error("draft_script is required");

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch knowledge for review context
    const [ytRes, scriptRes, triggersRes] = await Promise.all([
      sb.from("youtube_knowledge").select("category,title,content").order("priority", { ascending: false }).limit(5),
      sb.from("script_knowledge").select("category,title,content").order("effectiveness_score", { ascending: false }).limit(8),
      sb.from("viral_content_library").select("content_json,effectiveness_score,category").in("category", ["psychology_triggers", "retention_technique"]).order("effectiveness_score", { ascending: false }).limit(8),
    ]);

    const ytKnowledge = (ytRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const scriptKnowledge = (scriptRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const psychTriggers = (triggersRes.data || []).map((r: any) => {
      const c = r.content_json;
      return `• ${c.name || c.technique}: ${c.description || c.how_to_apply || ''}`;
    }).join("\n");

    const tw = target_words || 2000;

    const systemPrompt = `Você é um DIRETOR CRIATIVO IMPLACÁVEL que avalia roteiros para canais 10M+ inscritos.

🧠 CONHECIMENTO:
${ytKnowledge.slice(0, 2000)}

📝 TÉCNICAS:
${scriptKnowledge.slice(0, 2000)}

🧠 GATILHOS:
${psychTriggers.slice(0, 1500)}

🔍 CRITÉRIOS DE SCORING (1-10):
1. HOOK_SCORE: Hook impossível de ignorar?
2. RETENTION_SCORE: Pattern interrupts a cada 45s? Open loops? Micro-cliffhangers?
3. EMOTION_SCORE: Escalada emocional constante? Contraste?
4. FLOW_SCORE: Flui naturalmente? Parece conversa?
5. PAYOFF_SCORE: Final conecta ao hook?

🔧 PROCESSO:
1. Dê scores BRUTALMENTE HONESTOS
2. Se QUALQUER score < 8, REESCREVA as partes fracas
3. Se hook < 9, crie hook NOVO devastador
4. Injete mais pattern interrupts onde monótono
5. Torne CADA frase impossível de pular

⚠️ FORMATO:
PRIMEIRO: ---SCORES--- hook:X retention:X emotion:X flow:X payoff:X ---END_SCORES---
DEPOIS: Roteiro COMPLETO reescrito (narração + ---EXTRAS---)
DEPOIS: ---SCENE_BLUEPRINT--- [JSON array de blocos ~30-45s] ---END_SCENE_BLUEPRINT---

REGRAS: ZERO anotações técnicas no roteiro. Mínimo ${tw} palavras. Idioma: ${language || 'português'}. Valores em $.`;

    console.log("Phase 2: Streaming refine from Gemini Pro...");
    const refineRes = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `ROTEIRO PARA REVISAR E TURBINAR:\n\n${draft_script.slice(0, 25000)}\n\nMISSÃO: Transforme em algo que o espectador NÃO CONSIGA parar de assistir. Scores HONESTOS. Reescreva partes fracas. Retorne COMPLETO.` }
        ],
        stream: true,
      }),
    });

    if (!refineRes.ok) {
      if (refineRes.status === 429) return errResp("Rate limit. Aguarde.", 429);
      if (refineRes.status === 402) return errResp("Créditos insuficientes.", 402);
      console.error("Phase 2 error:", refineRes.status);
      throw new Error("Refine failed");
    }

    return new Response(refineRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("refine-script error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
