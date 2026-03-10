import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, videoStyle, characters, audioDurationSeconds, sceneDurationSeconds, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!script?.trim()) throw new Error("Script text required");

    const sceneLen = sceneDurationSeconds || 8;
    const totalDuration = audioDurationSeconds || 0;

    // Split script into scenes based on duration
    const sentences = script.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
    const totalChars = sentences.reduce((sum: number, s: string) => sum + s.length, 0);

    // Calculate number of scenes
    const numScenes = totalDuration > 0
      ? Math.max(1, Math.ceil(totalDuration / sceneLen))
      : Math.max(1, Math.ceil(sentences.length / 3));

    // Distribute sentences across scenes proportionally
    const scenes: { index: number; text: string; startTime: number; endTime: number }[] = [];
    const charsPerScene = Math.ceil(totalChars / numScenes);
    let currentSceneText = '';
    let currentSceneChars = 0;
    let sceneIndex = 0;

    for (const sentence of sentences) {
      currentSceneText += (currentSceneText ? ' ' : '') + sentence;
      currentSceneChars += sentence.length;

      if (currentSceneChars >= charsPerScene && sceneIndex < numScenes - 1) {
        scenes.push({
          index: sceneIndex,
          text: currentSceneText.trim(),
          startTime: sceneIndex * sceneLen,
          endTime: (sceneIndex + 1) * sceneLen,
        });
        sceneIndex++;
        currentSceneText = '';
        currentSceneChars = 0;
      }
    }

    // Push remaining text as last scene
    if (currentSceneText.trim()) {
      scenes.push({
        index: sceneIndex,
        text: currentSceneText.trim(),
        startTime: sceneIndex * sceneLen,
        endTime: totalDuration > 0 ? totalDuration : (sceneIndex + 1) * sceneLen,
      });
    }

    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Ultra-realistic cinematic photography. 35mm film grain, anamorphic lens flares, dramatic chiaroscuro lighting. Think Roger Deakins cinematography. Every frame looks like a movie still.',
      '2d': 'High-quality 2D animation style. Vibrant flat colors, clean linework, expressive character poses. Similar to modern motion graphics or Kurzgesagt style. Bold outlines, geometric shapes.',
      '3d': 'Pixar/Disney quality 3D rendering. Subsurface scattering on skin, volumetric lighting, detailed textures. Characters are stylized but realistic. Professional studio lighting setup.',
      'anime': 'High-quality anime art style. Dynamic poses, speed lines, expressive eyes. Studio Ghibli meets modern anime aesthetics. Detailed backgrounds, cel-shading, atmospheric lighting.',
      'wojak': 'Wojak/meme art style. Simple line drawings with emotional faces. Minimalist backgrounds. Characters express emotions through exaggerated facial features. Internet culture aesthetic.',
      'stickmen': 'Stick figure animation style. Simple black stick figures on white/colored backgrounds. Humor through simplicity. Expressive despite minimal detail. Clean and readable.',
      'realista': 'Photorealistic image. 8K resolution quality, natural lighting, accurate proportions. Looks like a real photograph taken with a professional DSLR camera.',
      'dark': 'Dark moody aesthetic. Deep shadows, neon accents, cyberpunk undertones. Dramatic contrast, fog/mist effects. Think Blade Runner meets noir cinema.',
      'whiteboard': 'Whiteboard animation style. Hand-drawn illustrations appearing on white background. Simple, educational, clean. Black ink with occasional color highlights.',
      'comic': 'Comic book/graphic novel style. Bold outlines, halftone dots, dynamic panel compositions. Speech bubbles, action lines, vivid colors. Marvel/DC aesthetic.',
    };

    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];

    // Build character descriptions for consistency
    const characterBlock = characters?.length > 0
      ? `\n\nCHARACTER CONSISTENCY (CRITICAL - use these EXACT descriptions every time a character appears):\n${characters.map((c: any, i: number) => {
          const a = c.appearance || {};
          const f = c.facial_features || {};
          const cl = c.clothing || {};
          return `Character ${i + 1} "${c.name}" (${c.gender || 'unknown'}, age ${c.age || '?'}):
  Appearance: ${a.skin_color || ''} skin, ${a.hair_color || ''} ${a.hair_style || ''} hair, ${a.eye_color || ''} eyes, ${a.body_type || ''} build, ${a.height || ''}
  Face: ${f.face_shape || ''} face, ${f.eyebrows || ''} eyebrows, ${f.nose || ''} nose, ${f.mouth || ''}, ${f.ears || ''} ears
  Clothing: ${cl.shirt || ''}, ${cl.pants || ''}, ${cl.shoes || ''}${cl.accessories && cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}
  Personality: ${(c.personality || []).join(', ')}`;
        }).join('\n\n')}`
      : '';

    const sceneTexts = scenes.map(s =>
      `Scene ${s.index + 1} [${formatTime(s.startTime)}-${formatTime(s.endTime)}]: "${s.text}"`
    ).join('\n\n');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        tools: [{
          type: "function",
          function: {
            name: "set_synced_prompts",
            description: "Generate synchronized visual prompts for each scene",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneIndex: { type: "number" },
                      startTime: { type: "number" },
                      endTime: { type: "number" },
                      visualPrompt: { type: "string", description: "Detailed visual prompt in English for image/video generation" },
                      cameraAngle: { type: "string", description: "e.g. close-up, wide shot, aerial, tracking, POV" },
                      mood: { type: "string", description: "e.g. tense, joyful, mysterious, epic" },
                      charactersInScene: { type: "array", items: { type: "string" }, description: "Names of characters appearing in this scene" },
                      transitionNote: { type: "string", description: "How to transition from previous scene" },
                    },
                    required: ["sceneIndex", "startTime", "endTime", "visualPrompt", "cameraAngle", "mood"],
                    additionalProperties: false
                  }
                }
              },
              required: ["scenes"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "set_synced_prompts" } },
        messages: [
          {
            role: "system",
            content: `You are an elite visual director and storyboard artist. You create synchronized visual prompts that match narration text perfectly.

VISUAL STYLE FOR ALL SCENES:
${selectedStyleGuide}
${characterBlock}

YOUR RULES:
1. Each prompt MUST visually represent what the narration is saying at that exact moment
2. Maintain VISUAL CONTINUITY between scenes (lighting, color palette, character consistency)
3. Each prompt should be 30-60 words, highly detailed and specific
4. Always include: subject, action, environment, lighting, camera angle, mood
5. If characters were defined, use their EXACT descriptions every time they appear
6. Vary camera angles between scenes for visual interest
7. Match the emotional tone of the narration text
8. Write ALL prompts in English for best AI generation results
9. Include the video style "${videoStyle || 'cinematográfico'}" aesthetics in every prompt
10. For transitions, suggest smooth visual connections between scenes`
          },
          {
            role: "user",
            content: `Generate synchronized visual prompts for ${scenes.length} scenes.
Total duration: ${totalDuration > 0 ? `${totalDuration}s (from audio)` : 'estimated from text'}
Scene duration: ~${sceneLen}s each
Video style: ${videoStyle || 'cinematográfico'}
Language of narration: ${language || 'português'}

SCENES TO VISUALIZE:

${sceneTexts}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Synced prompts error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate synced prompts");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      scenes: parsed.scenes,
      metadata: {
        totalScenes: scenes.length,
        totalDuration: totalDuration || scenes.length * sceneLen,
        sceneDuration: sceneLen,
        videoStyle: videoStyle || 'cinematográfico',
        charactersCount: characters?.length || 0,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-synced-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
