import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, videoStyle, characters, audioDurationSeconds, sceneDurationSeconds, language, niche, sceneBlueprintFromScript } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!script?.trim()) throw new Error("Script text required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ========== Fetch Scene Knowledge — FILTERED by style/niche ==========
    const styleLC = (videoStyle || 'cinematográfico').toLowerCase();
    const nicheLC = (niche || '').toLowerCase();

    // Build tag-based filter for relevant knowledge
    const relevantCategories = ['hook', 'transition', 'anti-ai', 'consistency', 'policy', 'veo3-policy', 'veo3-consistency'];
    
    // Map style/niche to relevant categories
    const styleCategories: Record<string, string[]> = {
      'cinematográfico': ['cinematography', 'lighting', 'camera'],
      '2d': ['animation', '2d-animation'],
      '3d': ['3d-animation', 'animation'],
      'anime': ['anime', 'animation'],
      'dark': ['dark', 'noir', 'horror'],
      'realista': ['photorealistic', 'documentary'],
      'whiteboard': ['whiteboard', 'educational'],
      'comic': ['comic', 'graphic-novel'],
    };
    const nicheCategories: Record<string, string[]> = {
      'mitologia': ['mythology', 'epic', 'ancient'],
      'guerra': ['war', 'documentary', 'military'],
      'oceano': ['underwater', 'ocean', 'deep-sea'],
      'conspiração': ['conspiracy', 'mystery', 'dark'],
      'história': ['historical', 'documentary', 'ancient'],
      'reddit': ['reddit', 'animation', '2d'],
      'horror': ['dark', 'horror', 'noir'],
      'documentário': ['documentary', 'war', 'historical'],
    };

    const extraCats = [
      ...(styleCategories[styleLC] || []),
      ...Object.entries(nicheCategories).filter(([k]) => nicheLC.includes(k)).flatMap(([, v]) => v),
    ];
    const allCategories = [...new Set([...relevantCategories, ...extraCats])];

    // Fetch filtered knowledge (up to 40 relevant records instead of generic top 20)
    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("category,title,prompt_template,tags")
      .order("viral_score", { ascending: false }).limit(150);

    // Score and rank knowledge by relevance
    const scored = (sceneKnowledge || []).map((r: any) => {
      let score = 0;
      const cat = r.category.toLowerCase();
      const tags = Array.isArray(r.tags) ? r.tags.map((t: string) => t.toLowerCase()) : [];
      if (allCategories.some(c => cat.includes(c))) score += 10;
      if (allCategories.some(c => tags.some((t: string) => t.includes(c)))) score += 5;
      if (relevantCategories.includes(cat)) score += 8; // Always include core categories
      return { ...r, relevanceScore: score };
    });
    scored.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
    const topKnowledge = scored.slice(0, 40);

    const knowledgeBlock = topKnowledge.map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}:\n${r.prompt_template}`
    ).join("\n\n");

    // ========== Fetch Script Knowledge — Retention techniques ==========
    const { data: scriptKnowledge } = await sb.from("script_knowledge")
      .select("category,title,content")
      .order("effectiveness_score", { ascending: false }).limit(15);

    const retentionBlock = (scriptKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}: ${r.content.slice(0, 200)}`
    ).join("\n\n");

    // ========== Fetch Viral Patterns from channel_intelligence ==========
    let viralPatternsBlock = '';
    if (nicheLC) {
      const { data: channels } = await sb.from("channel_intelligence")
        .select("channel_name,visual_style_notes,viral_patterns,style")
        .ilike("niche", `%${nicheLC}%`)
        .order("avg_views", { ascending: false }).limit(5);
      if (channels?.length) {
        viralPatternsBlock = `\n\nVIRAL PATTERNS FROM TOP CHANNELS IN "${nicheLC}":\n` +
          channels.map((c: any) => {
            const patterns = typeof c.viral_patterns === 'object' ? JSON.stringify(c.viral_patterns) : '';
            return `${c.channel_name} (${c.style}): ${c.visual_style_notes || ''} ${patterns}`;
          }).join('\n');
      }
    }

    // ========== Parse script into sentences ==========
    const defaultSceneLen = sceneDurationSeconds || 8;
    const totalDuration = audioDurationSeconds || 0;
    const sentences = script.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
    const totalChars = sentences.reduce((sum: number, s: string) => sum + s.length, 0);

    const numScenes = totalDuration > 0
      ? Math.max(1, Math.ceil(totalDuration / defaultSceneLen))
      : Math.max(1, Math.ceil(sentences.length / 3));

    const scenes: { index: number; text: string }[] = [];
    const charsPerScene = Math.ceil(totalChars / numScenes);
    let currentText = '';
    let currentChars = 0;
    let idx = 0;

    for (const sentence of sentences) {
      currentText += (currentText ? ' ' : '') + sentence;
      currentChars += sentence.length;
      if (currentChars >= charsPerScene && idx < numScenes - 1) {
        scenes.push({ index: idx, text: currentText.trim() });
        idx++;
        currentText = '';
        currentChars = 0;
      }
    }
    if (currentText.trim()) scenes.push({ index: idx, text: currentText.trim() });

    // ========== Style guides (Netflix/Disney grade) ==========
    const styleGuides: Record<string, string> = {
      'cinematográfico': `Netflix/Disney premium cinematography. Shot on ARRI ALEXA 65 with Cooke Anamorphic S7/i lenses. ACES color science, Kodak Vision3 500T film emulation. Shallow DOF f/1.4-2.8, creamy bokeh. Skin tones warm and natural with visible pores. Lifted blacks, subtle halation on highlights. Volumetric god rays, atmospheric haze. Reference: Roger Deakins, Bradford Young, Hoyte van Hoytema.`,
      '2d': `Premium 2D animation, Kurzgesagt meets Studio Trigger. Vibrant flat colors, clean vector linework, bold outlines, parallax depth layers, smooth 24fps feel. Rich color palettes, dynamic compositions.`,
      '3d': `Pixar/DreamWorks/Illumination feature-film 3D. Subsurface scattering on skin, PBR materials, global illumination with ray-traced reflections. Strand-based hair simulation. 8K textures, micro-detail on surfaces.`,
      'anime': `Top-tier anime production (Ufotable/MAPPA/WIT Studio). Dynamic sakuga key poses, Makoto Shinkai-level backgrounds, professional cel-shading, rim lighting, volumetric particle systems, dramatic speed lines.`,
      'wojak': 'Wojak/meme art style. Simple clean line drawings, expressive emotional faces, minimalist backgrounds, internet culture aesthetic.',
      'stickmen': 'Stick figure animation. Simple black figures on clean white backgrounds. Humor through simplicity and timing.',
      'realista': `Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM lens, 8K resolution, natural available light, pore-level skin detail, strand-level hair, fabric texture. Zero AI artifacts. Documentary-grade realism.`,
      'dark': `Dark cinematic noir. Crushed blacks, neon accent lighting (cyan, magenta, amber). Dense volumetric fog. Blade Runner 2049 meets Se7en. Noir shadow patterns, wet reflective surfaces, silhouettes.`,
      'whiteboard': 'Whiteboard explainer animation. Hand-drawn black ink on clean white surface. Strategic color highlights for emphasis. Educational clarity, smooth drawing reveal.',
      'comic': 'Premium graphic novel / Marvel comic art. Bold ink outlines, Ben-Day halftone dots, dynamic panel compositions, rich saturated colors, dramatic perspective.',
    };
    const selectedStyleGuide = styleGuides[styleLC] || styleGuides['cinematográfico'];

    // ========== Character identity block ==========
    const characterBlock = characters?.length > 0
      ? `\n\nCHARACTER IDENTITY SHEETS — COPY THIS TEXT VERBATIM INTO EVERY PROMPT WHERE CHARACTER APPEARS:\n${characters.map((c: any, i: number) => {
          const a = c.appearance || {};
          const f = c.facial_features || {};
          const cl = c.clothing || {};
          const refImg = c.imageUrl ? `\nREFERENCE IMAGE: ${c.imageUrl} — Match this exact appearance.` : '';
          return `═══ CHARACTER ${i + 1}: "${c.name}" ═══
Gender: ${c.gender || 'unknown'} | Age: ${c.age || 'unknown'}
BODY: ${a.body_type || 'average'} build, ${a.height || 'average'} height, ${a.skin_color || 'medium'} skin with natural pores and micro-imperfections
HAIR: ${a.hair_color || 'dark'} ${a.hair_style || 'short'} hair with individual strand detail
EYES: ${a.eye_color || 'brown'} eyes, ${f.eyebrows || 'natural'} eyebrows
FACE: ${f.face_shape || 'oval'} face, ${f.nose || 'straight'} nose, ${f.mouth || 'natural'} mouth, natural skin texture
OUTFIT: ${cl.shirt || 'casual top'}, ${cl.pants || 'jeans'}, ${cl.shoes || 'sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}${refImg}`;
        }).join('\n\n')}\n\n⚠️ ABSOLUTE RULE: Include FULL character description block in EVERY prompt they appear in. Use IDENTICAL wording — never paraphrase.`
      : '';

    const sceneTexts = scenes.map(s => `Scene ${s.index + 1}: "${s.text}"`).join('\n\n');

    // ========== Scene Blueprint from Script (narrative intent) ==========
    let blueprintBlock = '';
    if (sceneBlueprintFromScript && Array.isArray(sceneBlueprintFromScript) && sceneBlueprintFromScript.length > 0) {
      blueprintBlock = `\n\n═══ SCENE BLUEPRINT FROM SCRIPT (NARRATIVE INTENT — ALIGN VISUALS TO THIS) ═══\n` +
        sceneBlueprintFromScript.map((bp: any, i: number) => 
          `Block ${bp.block || i+1}: ${bp.narrative_summary || ''} | Mood: ${bp.mood || 'neutral'} | Visual: ${bp.visual_hint || ''} | Camera: ${bp.camera_suggestion || ''} | Characters: ${(bp.characters_present || []).join(', ') || 'none'}`
        ).join('\n') +
        `\n⚠️ ALIGN each scene's mood, camera, and visual style to the corresponding blueprint block above.\n`;
    }

    // ========== AI Generation — Veo3 Optimized ==========
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        tools: [{
          type: "function",
          function: {
            name: "set_synced_prompts",
            description: "Generate Veo3-optimized synchronized visual prompts with dynamic duration per scene",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneIndex: { type: "number" },
                      sceneDurationSeconds: { type: "number", description: "Dynamic 5-8s. Hook scene 1: 8s. Action: 5-6s. Emotional: 7-8s." },
                      startTime: { type: "number" },
                      endTime: { type: "number" },
                      visualPrompt: { type: "string", description: "100-200 word Veo3 prompt. Structure: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. MUST end with: (no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)" },
                      negativePrompt: { type: "string", description: "Negative exclusions: subtitles, text, titles, captions, logos, watermarks, writing, letters, words, lower thirds, on-screen graphics, burned-in text, UI elements, blurry, distorted, deformed hands, extra fingers, six fingers, fused fingers, melted hands, mutated body parts, bad anatomy, disfigured, poorly drawn face, amateur, low quality, jpeg artifacts, oversaturated, underexposed" },
                      cameraAngle: { type: "string", description: "Specific Veo3 camera: dolly shot, tracking shot, crane shot, steadicam, slow pan, orbit shot, push-in, pull-out, rack focus, Dutch angle, POV" },
                      lensSpec: { type: "string", description: "Lens: 24mm wide, 35mm, 50mm, 85mm portrait, 135mm telephoto, anamorphic" },
                      lightingSetup: { type: "string", description: "Lighting: golden hour, Rembrandt, butterfly, split, rim/edge, volumetric, chiaroscuro, practical lights, neon" },
                      audioDirection: { type: "string", description: "Audio cues: ambient sounds, foley SFX, music mood. NO dialogue unless narration requires it" },
                      mood: { type: "string" },
                      charactersInScene: { type: "array", items: { type: "string" } },
                      transitionNote: { type: "string" },
                    },
                    required: ["sceneIndex", "sceneDurationSeconds", "startTime", "endTime", "visualPrompt", "negativePrompt", "cameraAngle", "lensSpec", "lightingSetup", "mood"],
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
            content: `You are a WORLD-CLASS visual director creating prompts for Google Veo 3 video generation model. Your prompts produce Netflix/Disney/Marvel-grade cinematic video.

═══════════════════════════════════════
🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
═══════════════════════════════════════
NEVER include ANY of these in prompts:
- NO subtitles, NO text, NO titles, NO captions
- NO logos, NO watermarks, NO signatures  
- NO on-screen graphics, NO lower thirds, NO burned-in text, NO UI elements
- NO letters, NO words, NO writing of ANY kind
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"
- EVERY negativePrompt MUST include: "subtitles, text, titles, captions, logos, watermarks, writing, letters, words, lower thirds, on-screen graphics, burned-in text, UI elements"
═══════════════════════════════════════

VEO 3 MASTER PROMPT FORMULA v2.0 (use for EVERY prompt):
[SHOT_TYPE + CAMERA_MOTION], [LENS_SPEC] with [DOF_SETTING].
[CHARACTER — FULL identity VERBATIM if applicable].
[ACTION — cinematic description of what happens].
[ENVIRONMENT — specific, sensory, atmospheric details].
[LIGHTING_SETUP — exact type + modifiers].
[ATMOSPHERIC_ELEMENTS — particles, fog, rain, dust, embers].
[COLOR_GRADE — specific film stock or palette reference].
[ANTI_AI_REALISM — skin pores, motion blur, film grain, lens artifacts].
[QUALITY_TAGS]: masterpiece, award-winning cinematography, 8K UHD, photorealistic, Kodak Vision3, ACES color science.
[AUDIO_DIRECTION]: ambient sounds + foley SFX + music mood.
(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)

MASTER VISUAL STYLE:
${selectedStyleGuide}
${characterBlock}

🎓 CINEMATIC & VEO3 KNOWLEDGE BASE (FILTERED FOR THIS STYLE/NICHE):
${knowledgeBlock}

📖 RETENTION TECHNIQUES (apply to visual storytelling):
${retentionBlock}
${viralPatternsBlock}
${blueprintBlock}

YOUR COMMANDMENTS:

1. DYNAMIC SCENE DURATION: Veo3 generates 4, 6, or 8 second clips:
   - HOOK SCENE (Scene 1): 8s — MOST spectacular, impossible-to-ignore opening shot
   - Action/transition scenes: 6s — fast-paced, energetic
   - Emotional/descriptive scenes: 8s — lingering, atmospheric
   - Quick cuts/pattern interrupts: 4s — sharp visual change
   - Calculate startTime/endTime cumulatively

2. SCENE 1 = HOOK (MAGNETIC HOOK FORMULA): Must combine:
   - MYSTERY (what is this?) — partial reveal, obscured subject
   - SCALE (epic/impossible) — massive landscape, extreme macro
   - MOTION (dynamic camera) — dolly, crane, or drone movement
   - DETAIL (micro-textures that prove quality) — pores, dust, water droplets
   Prefix with "HOOK SCENE —"

3. PROMPT LENGTH: 100-200 words. Use EXACT professional film terminology that Veo3 understands best:
   Camera: dolly-in, tracking shot, crane shot, steadicam, slow pan, orbit shot, push-in, pull-out, rack focus, Dutch angle, POV, handheld
   Lens: 24mm wide, 35mm, 50mm, 85mm portrait, 135mm telephoto, anamorphic
   Lighting: golden hour, Rembrandt, butterfly, split, rim/edge, volumetric/god rays, chiaroscuro, practical lights, neon glow

4. MULTI-MOMENT TECHNIQUE: For scenes requiring visual variety within 8 seconds, describe 2-3 visual moments with natural transitions:
   - Use connectors: "seamlessly transforms into", "camera pushes through into", "rack focus pulls to reveal"
   - First moment: 2-3s (hook/setup)
   - Transition: 1s (natural, not jarring)
   - Final moment: most impactful payoff
   - Maintain color palette continuity across moments

5. ANTI-AI REALISM (include in every prompt): natural skin pores and micro-imperfections, asymmetric composition, motion blur (180-degree shutter), lens breathing on focus pulls, chromatic aberration on highlight edges, Kodak Vision3 500T film grain, atmospheric dust particles, subtle camera shake on handheld, cloth wrinkles, environmental wear/age/dirt.

6. CAMERA VARIETY (STRICT): Never repeat camera angles in consecutive scenes.
   Mandatory rotation pattern: ECU → Wide → Tracking → Drone/Aerial → MCU → OTS → Crane → POV
   Use 5+ different shot types across the video.
   Every 4th scene: mandatory "pattern interrupt" — radically different visual from previous 3.
   Never 3 consecutive scenes without a human close-up.

7. DOPAMINERGIC VISUALS: DOPAMINE = (NOVELTY × BEAUTY × MOTION) / PREDICTABILITY
   - First 3 seconds of EACH scene must trigger curiosity or dopamine
   - Each scene must show something the viewer has NEVER seen before
   - Camera ALWAYS in motion (never static >2s)
   - Alternate between slow-motion moments and normal speed
   - Use visual "pattern interrupts" — unexpected angle changes, dramatic reveals, contrast shifts

8. NARRATION-VISUAL SYNC: Each scene's visual MUST directly illustrate the narrated content:
   - Literal sync: concrete objects mentioned → show them
   - Metaphorical: abstract concepts → visual metaphors (fear → growing shadows)
   - Emotional: narration tone → color temperature (sad → cool blues, exciting → warm oranges)
   - Progressive: escalating tone → camera approaches, colors intensify, scale increases
   - NEVER show generic visuals disconnected from the narration

9. AUDIO DIRECTION: Specify ambient sounds, foley SFX, and music mood per scene. NEVER describe on-screen text.

10. ALL PROMPTS IN ENGLISH.

═══ AUTOFLOW FORMAT RULES ═══
The output will be used in the AutoFlow extension (Frame-to-Video). The visualPrompt becomes the IMAGE prompt (left side of |||) and cameraAngle+lensSpec+lightingSetup+mood become the VIDEO prompt (right side of |||).

FORMAT: [V1-S#] {visualPrompt} ||| [V1-S#] {camera movement}, {lens}, {lighting} lighting, {mood} mood
- One prompt per line, one line per scene
- Tags: [V#-S#] where V=video number, S=scene number
- LEFT of ||| = image generation prompt (the visualPrompt field — describe the STILL frame)
- RIGHT of ||| = video animation prompt (camera movement, lens spec, lighting, mood — describe HOW to animate the still)
- The VIDEO prompt (right side) must be CAMERA MOTION focused
- NEVER put scene descriptions in the video prompt — only camera/motion/lighting/mood
═══════════════════════════════════════`
          },
          {
            role: "user",
            content: `Generate ${scenes.length} NETFLIX/DISNEY-GRADE Veo3 video prompts with DYNAMIC DURATION.
Total audio: ${totalDuration > 0 ? `${totalDuration}s` : 'estimate from text'}
Default scene: ~${defaultSceneLen}s (vary 5-8s based on content)
Style: ${videoStyle || 'cinematográfico'}
Niche: ${niche || 'general'}
Language context: ${language || 'português'}

CRITICAL RULES:
1. Scene 1 = HOOK — most visually stunning shot possible
2. ZERO text/subtitles/captions in ANY prompt
3. Every prompt ends with "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"
4. Use Veo3 formula: [Cinematography] + [Subject] + [Action] + [Context] + [Style]
5. Apply RETENTION TECHNIQUES from knowledge base to visual storytelling
6. Reference VIRAL PATTERNS from top channels in this niche

SCENES:\n\n${sceneTexts}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Synced prompts error:", response.status, t);
      if (response.status === 429) return errResp("Rate limit.", 429);
      if (response.status === 402) return errResp("Créditos insuficientes.", 402);
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
        totalDuration: totalDuration || parsed.scenes.reduce((s: number, sc: any) => s + (sc.sceneDurationSeconds || defaultSceneLen), 0),
        videoStyle: videoStyle || 'cinematográfico',
        charactersCount: characters?.length || 0,
        knowledgeRecordsUsed: topKnowledge.length,
        retentionTechniquesUsed: scriptKnowledge?.length || 0,
        viralPatternsUsed: viralPatternsBlock ? true : false,
        dynamicTiming: true,
        veo3Optimized: true,
        antiTextEnforced: true,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-synced-prompts error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
