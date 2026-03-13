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
    const { script, durationSeconds, videoStyle, characters, customStyleNotes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    const dur = parseInt(durationSeconds) || 45;
    // Shorts = 4-8 scenes of 4-8s each
    const sceneCount = Math.max(3, Math.min(8, Math.round(dur / 6)));

    // Fetch scene prompt knowledge for style
    const { data: promptKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("prompt_template,category,title")
      .order("viral_score", { ascending: false })
      .limit(5);

    const knowledgeBlock = (promptKnowledge || []).map((r: any) =>
      `[${r.category}] ${r.title}: ${r.prompt_template.slice(0, 200)}`
    ).join("\n");

    // Character descriptions
    const charBlock = Array.isArray(characters) && characters.length > 0
      ? characters.map((c: any) =>
        `👤 ${c.name}: ${c.visual_prompt || JSON.stringify(c.visual_attributes || {})}`
      ).join("\n")
      : '';

    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Ultra-cinematic, dramatic lighting, shallow DOF, film grain. Aspect: 9:16 vertical.',
      '2d': 'Flat 2D motion graphics, bold colors, clean shapes. Vertical composition.',
      '3d': '3D stylized render, Pixar-quality, expressive characters. Vertical framing.',
      'anime': 'Anime style, dynamic angles, expressive faces. Vertical 9:16.',
      'wojak': 'Wojak/meme style, simple emotional faces, internet culture. Vertical.',
      'stickmen': 'Stick figure animation, minimalist, humor through simplicity. Vertical.',
      'realista': 'Photorealistic, 8K, natural lighting, vertical composition.',
      'dark': 'Dark/cyberpunk, deep shadows, neon accents, atmospheric. Vertical.',
      'whiteboard': 'Whiteboard animation, hand-drawn style, educational. Vertical.',
      'comic': 'Comic/HQ style, bold outlines, action poses. Vertical panels.',
    };
    const selectedVisual = styleGuides[(videoStyle || '').toLowerCase()] || styleGuides['cinematográfico'];

    const systemPrompt = `Você é um diretor de arte especialista em YouTube Shorts / TikTok / Reels.

📱 FORMATO: VERTICAL 9:16 — Shorts de ${dur} segundos
🎬 ESTILO: ${selectedVisual}
${customStyleNotes ? `✨ NOTAS DO USUÁRIO: ${customStyleNotes}` : ''}

${knowledgeBlock ? `📚 REFERÊNCIAS VISUAIS:\n${knowledgeBlock}\n` : ''}
${charBlock ? `👥 PERSONAGENS:\n${charBlock}\n` : ''}

Gere EXATAMENTE ${sceneCount} cenas para este Short.

Retorne um JSON array VÁLIDO com esta estrutura EXATA:
[
  {
    "sceneIndex": 1,
    "startTime": 0,
    "endTime": 6,
    "sceneDurationSeconds": 6,
    "narrativeText": "texto falado nesta cena",
    "visualPrompt": "prompt visual detalhado em inglês para geração de imagem/vídeo, VERTICAL 9:16, ...",
    "cameraAngle": "close-up / medium / wide / extreme close-up / bird eye / low angle",
    "mood": "tense / exciting / mysterious / funny / shocking / calm",
    "emotionalBeat": "hook / curiosity / reveal / twist / loop",
    "transitionNote": "hard cut / whip pan / zoom / glitch / none",
    "negativePrompt": "blurry, horizontal, watermark, text, low quality"
  }
]

REGRAS VERTICAIS (9:16):
1. TODOS os prompts visuais devem especificar "vertical 9:16 composition"
2. Foco no CENTRO do frame — texto e faces no terço central
3. Cortes RÁPIDOS — máximo 8s por cena, ideal 4-6s
4. Primeiro scene = HOOK VISUAL (impacto imediato, 2-4s)
5. Último scene = LOOP (visual que conecta ao início)
6. Negativa: SEMPRE incluir "horizontal composition, 16:9, letterbox"
7. Cada transição deve ser DINÂMICA (hard cut, whip pan, zoom)
8. Incluir referências de lente/câmera específicas para mobile`;

    const res = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere ${sceneCount} cenas VERTICAIS 9:16 para este Short de ${dur}s:\n\n${script}\n\nRetorne APENAS o JSON array.` }
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return errResp("Rate limit.", 429);
      if (res.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error("Scene generation failed");
    }

    const d = await res.json();
    const content = d.choices?.[0]?.message?.content || '';
    let scenes: any[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) scenes = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("JSON parse error:", e);
      return errResp("Erro ao parsear cenas geradas", 500);
    }

    return new Response(JSON.stringify({ scenes, sceneCount: scenes.length, format: "9:16" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-scenes-short error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
