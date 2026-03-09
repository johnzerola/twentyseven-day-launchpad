import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, duration, style, niche, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const wordsPerMinute = 140; // Average speaking rate
    const targetWords = (duration || 15) * wordsPerMinute;
    const targetChars = targetWords * 5.5;

    const systemPrompt = `Você é um ROTEIRISTA VETERANO que trabalhou com MrBeast, Disney, HBO e produções dignas de Oscar. Você é especialista em:
- Retenção de 80%+ em vídeos do YouTube
- Hooks que prendem nos primeiros 8 segundos
- Microhooks a cada 30-60 segundos para manter engajamento
- Estrutura narrativa que cria tensão e curiosidade
- CTAs naturais que não parecem forçados
- Storytelling estilo "bola de neve" que cresce em intensidade

REGRAS OBRIGATÓRIAS:
1. O roteiro DEVE ter pelo menos ${targetWords} palavras (~${Math.round(targetChars)} caracteres) para cobrir ${duration} minutos de vídeo narrado
2. Cada minuto de vídeo = ~140 palavras faladas
3. Use a estrutura: HOOK (8s) → Introdução (30s) → Desenvolvimento com microhooks → Clímax → CTA
4. Inclua MARCAÇÕES DE TEMPO aproximadas [00:00], [01:30], etc.
5. Inclua indicações de [B-ROLL], [TEXTO NA TELA], [EFEITO SONORO], [TRANSIÇÃO]
6. NO FINAL, adicione:
   - 3 sugestões de TÍTULO com CTR 30%+ (use números, palavras de poder, curiosidade)
   - 3 ideias de THUMBNAIL (descrição visual detalhada)
   - Tags SEO recomendadas (10-15 tags)
   - Descrição otimizada para SEO (2-3 parágrafos)

Estilo do roteiro: ${style || 'narração'}
Nicho: ${niche || 'geral'}
Idioma do roteiro: ${language || 'português'}

ESCREVA O ROTEIRO COMPLETO. NÃO use placeholders como "[continue aqui]" ou "[expanda]". Cada seção deve estar TOTALMENTE ESCRITA.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Escreva um roteiro COMPLETO de ${duration} minutos sobre: "${topic}"\n\nO roteiro deve ter no mínimo ${targetWords} palavras. Não encurte, não use placeholders. Escreva TUDO.` }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Script generation failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
