import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { applyVeo3PolicyFilter, VEO3_POLICY_PROMPT, ANTI_TEXT_SUFFIX } from "../_shared/veo3-policy-filter.ts";
import { PROMPT_ANATOMY_CHECKLIST, SCENE_COVERAGE_STRATEGY, CAMERA_SHOT_VARIETY_RULES, MULTI_CHARACTER_RULES, CHARACTER_TAG_FORMAT, validatePromptAnatomy, buildConditionalTraining } from "../_shared/video-production-training.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, videoStyle, characters, audioDurationSeconds, sceneDurationSeconds, language, niche, sceneBlueprintFromScript } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
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

    // CRITICAL: Veo3 generates 8-second clips. For 80s audio → minimum 10 scenes.
    // Formula: ceil(duration / 8) ensures full coverage with no gaps.
    const numScenes = totalDuration > 0
      ? Math.max(Math.ceil(totalDuration / 8), Math.ceil(totalDuration / defaultSceneLen))
      : Math.max(1, Math.ceil(sentences.length / 2));

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
      'fotorrealista_documentario': 'Documentary photography style, natural soft lighting, shallow depth of field, Canon 5D aesthetic, desaturated color palette with emphasis on earth tones.',
      'ilustracao_artistica': 'Fine art illustration. Painterly brushstrokes, rich color palettes, gallery-quality compositions. Classical oil painting meets modern digital art.',
      'aquarela': 'Watercolor painting. Soft translucent washes, visible paper grain, bleeding color edges, delicate brushwork, organic imperfections.',
    };
    const selectedStyleGuide = styleGuides[styleLC] || styleGuides['cinematográfico'];

    // ═══ DarkPlanner v3: Detect content type for prompt density ═══
    const allScriptText = script.toLowerCase();
    const isDocumentary = /documentário|documentary|história real|true story/i.test(allScriptText);
    const isAction = /perseguição|explosão|corrida|luta|chase|action|fight|escape/i.test(allScriptText);
    const contentType = isDocumentary ? 'documentary' : isAction ? 'action' : 'standard';

    // ═══ Character Identity Sheets — DarkPlanner v3 (150-200 words, "waist up") ═══
    const characterBlock = (!isDocumentary && characters?.length > 0)
      ? `\n\n═══ DARKPLANNER v3 CHARACTER IDENTITY SHEETS — COPY VERBATIM ═══\n${characters.slice(0, 5).map((c: any) => {
          const a = c.appearance || {};
          const f = c.facial_features || {};
          const cl = c.clothing || {};
          const refImg = c.imageUrl ? `\nREFERENCE IMAGE: ${c.imageUrl} — Match this exact appearance.` : '';
          return `[${c.name}]: ${c.gender || 'person'} approximately ${c.age || 'adult'} years old, ${a.body_type || 'average'} build with ${a.height || 'average'} height. Skin: ${a.skin_color || 'medium'} tone with natural pores, micro-imperfections, and subtle texture visible under directional lighting. Hair: ${a.hair_color || 'dark'} ${a.hair_style || 'short'} hair with individual strand detail, natural highlights catching light. Eyes: ${a.eye_color || 'brown'} with ${f.eyebrows || 'natural'} eyebrows framing expressive gaze. Face: ${f.face_shape || 'oval'} face shape, ${f.nose || 'straight'} nose, ${f.mouth || 'natural'} lips. Clothing: ${cl.shirt || 'casual fitted top'} with visible fabric weave and natural wrinkles, ${cl.pants || 'well-fitted jeans'} with authentic wear patterns, ${cl.shoes || 'clean sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, accessories: ${cl.accessories}` : ''}. Hands show natural calluses and nail detail.${refImg} Always framed waist up.`;
        }).join('\n\n')}\n\n⚠️ DARKPLANNER v3 ABSOLUTE RULES:
- COPY FULL character description VERBATIM in EVERY prompt they appear in
- NEVER paraphrase: "wearing yellow dress" → "in her yellow outfit" = VIOLATION
- Maximum 2 characters per prompt — split if 3+ needed
- Always end character with "waist up"`
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

    // ========== AI Generation — Veo3 Optimized (Gemini Direct) ==========
    const systemContent = `You are a WORLD-CLASS visual director creating prompts for Google Veo 3 video generation model, trained on the DarkPlanner professional prompt system. Your prompts produce Netflix/Disney/Marvel-grade cinematic video.

═══════════════════════════════════════
🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
═══════════════════════════════════════
NEVER include ANY of these in prompts:
- NO subtitles, NO text, NO titles, NO captions
- NO logos, NO watermarks, NO signatures  
- NO on-screen graphics, NO lower thirds, NO burned-in text, NO UI elements
- EVERY prompt MUST end with: "${ANTI_TEXT_SUFFIX}"
- EVERY negativePrompt MUST include: "subtitles, text, titles, captions, logos, watermarks, writing, letters, words, lower thirds, on-screen graphics, burned-in text, UI elements"
═══════════════════════════════════════

${VEO3_POLICY_PROMPT}

═══ POLICY COMPLIANCE — SENSITIVE CONTENT ADAPTATION (DarkPlanner v3) ═══
NEVER include explicit violence, visible weapons, blood/gore, death scenes, nudity.
ADAPTATION TECHNIQUES:
• VIOLENCE → TENSION/CONSEQUENCE: "aggressive body language, clenched fists, no physical contact shown"
• WEAPONS → IMPLICATION: "defensive stance, hand at holster, no weapons visible"
• DEATH → MEMORIAL/AFTERMATH: "white sheet covering shape, grief visible, respectful framing"

═══ DARKPLANNER v3 — COMPLETE PROMPT RULES ═══

1. PROMPT LENGTH: 150-250 words per prompt (MINIMUM 150).
${isDocumentary ? '\n   DOCUMENTARY MODE ACTIVE: Focus on locations/atmosphere. 1 prompt per ~60s. No character identity sheets needed.\n' : ''}
2. CHARACTER CONSISTENCY:
   - Clothing/appearance COPIED WORD-FOR-WORD from identity sheet
   - ❌ NEVER paraphrase
   - ✅ ALWAYS: Copy EXACT same wording every time
   - Max 2 characters per prompt

3. MANDATORY MOVEMENT in EVERY prompt (at least 2 types):
   CHARACTER: walking, turning, reaching, breathing heavily, trembling
   CAMERA: pushing in, pulling back, panning, circling, tracking
   ENVIRONMENT: wind blowing, particles floating, water flowing, flames flickering

4. ENVIRONMENT DETAIL (prevent white/buggy backgrounds):
   ALWAYS include: specific location + materials, visible surroundings, light source + direction, textures, small props

VEO 3 MASTER PROMPT FORMULA v2.0:
[SHOT_TYPE + CAMERA_MOTION], [LENS_SPEC] with [DOF_SETTING].
[CHARACTER — FULL identity VERBATIM if applicable, ending "waist up"].
[ACTION — cinematic description with movement verbs].
[ENVIRONMENT — specific, sensory, atmospheric details].
[LIGHTING_SETUP — exact type + modifiers].
[ATMOSPHERIC_ELEMENTS — particles, fog, rain, dust, embers].
[COLOR_GRADE — specific film stock or palette reference].
[ANTI_AI_REALISM — skin pores, motion blur, film grain, lens artifacts].
[QUALITY_TAGS]: masterpiece, award-winning cinematography, 8K UHD, photorealistic, Kodak Vision3, ACES color science.
[AUDIO_DIRECTION]: ambient sounds + foley SFX + music mood.
(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)

${PROMPT_ANATOMY_CHECKLIST}
${SCENE_COVERAGE_STRATEGY}
${CAMERA_SHOT_VARIETY_RULES}
${MULTI_CHARACTER_RULES}
${CHARACTER_TAG_FORMAT}
${buildConditionalTraining(script)}

MASTER VISUAL STYLE:
${selectedStyleGuide}
${characterBlock}

🎓 CINEMATIC & VEO3 KNOWLEDGE BASE:
${knowledgeBlock}

📖 RETENTION TECHNIQUES:
${retentionBlock}
${viralPatternsBlock}
${blueprintBlock}

YOUR COMMANDMENTS:
1. DYNAMIC SCENE DURATION: EVERY scene = 8 seconds (Veo3 hard limit).
   For ${totalDuration > 0 ? `${totalDuration}s audio → MINIMUM ${Math.ceil((totalDuration || 80) / 8)} scenes` : 'estimate from text'}
   HOOK SCENE (Scene 1): 8s — MOST spectacular opening shot.
2. SCENE 1 = HOOK: MYSTERY + SCALE + MOTION + DETAIL. Prefix with "HOOK SCENE —"
3. PROMPT LENGTH: 150-250 words. Professional film terminology.
4. MULTI-MOMENT TECHNIQUE: 2-3 visual moments within 8s with natural transitions.
5. ANTI-AI REALISM: natural skin pores, motion blur, film grain, lens breathing.
6. CAMERA VARIETY (STRICT): Never repeat angles in consecutive scenes. 5+ different shot types.
7. DOPAMINERGIC VISUALS: DOPAMINE = (NOVELTY × BEAUTY × MOTION) / PREDICTABILITY.
   Every scene must create a VISCERAL emotional response — the viewer must feel compelled to keep watching.
8. NARRATION-VISUAL SYNC: Each scene's visual MUST directly illustrate the narrated content.
9. AUDIO DIRECTION: Specify ambient sounds, foley SFX, and music mood per scene.
10. ALL PROMPTS IN ENGLISH.
11. ENVIRONMENT IDENTITY SHEET — For EVERY scene, generate a COMPLETE "environment" object.
    CONTINUITY RULES: Same location = identical details. Track time progression. Gradual weather changes.`;

    const userContent = `Generate ${scenes.length} NETFLIX/DISNEY-GRADE Veo3 video prompts.
Total audio: ${totalDuration > 0 ? `${totalDuration}s` : 'estimate from text'}
CRITICAL: Each Veo3 clip = 8 seconds. Minimum scenes needed: ${Math.ceil((totalDuration || 80) / 8)}
Style: ${videoStyle || 'cinematográfico'}
Niche: ${niche || 'general'}
Language context: ${language || 'português'}

ABSOLUTE RULES:
1. Scene 1 = HOOK
2. ZERO text/subtitles in ANY prompt
3. Every prompt ends with anti-text suffix
4. EACH scene's visual MUST match what is being NARRATED
5. Apply DarkPlanner v3: movement trio + environment detail + policy compliance

SCENES:

${sceneTexts}

Respond with ONLY valid JSON: {"scenes":[{"sceneIndex":0,"sceneDurationSeconds":8,"startTime":0,"endTime":8,"visualPrompt":"text","negativePrompt":"text","cameraAngle":"text","lensSpec":"text","lightingSetup":"text","audioDirection":"text","mood":"text","charactersInScene":["name"],"transitionNote":"text","environment":{"locationName":"text","locationType":"text","timeOfDay":"text","weather":"text","lightSource":"text","shadowDirection":"text","shadowIntensity":"text","colorTemperature":"text","dominantColors":["color"],"atmosphericElements":"text","surfaceTextures":"text","depthLayers":"text","framingComposition":"text","architecturalDetails":"text","natureLandscape":"text","propsDressing":"text","continuityNotes":"text"}}]}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemContent }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 32768,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Synced prompts error:", response.status, t);
      if (response.status === 429) return errResp("Rate limit.", 429);
      throw new Error("Failed to generate synced prompts");
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) throw new Error("No content in Gemini response");
    const parsed = JSON.parse(rawContent);

    // ═══ DarkPlanner v3 Post-Processing: FULL Veo3 Policy Filter ═══
    const validationWarnings: string[] = [];
    const autoFixes: string[] = [];

    for (const scene of parsed.scenes) {
      if (typeof scene.visualPrompt === 'string') {
        // FULL Veo3 policy filter (copyright + celebrity + brand + trigger words + anti-text)
        const { cleaned, fixes } = applyVeo3PolicyFilter(scene.visualPrompt);
        if (fixes.length > 0) {
          scene.visualPrompt = cleaned;
          autoFixes.push(...fixes.map(f => `Scene ${scene.sceneIndex}: ${f}`));
        }
        // Word count check
        const wc = scene.visualPrompt.split(/\s+/).length;
        if (wc < 100) validationWarnings.push(`Scene ${scene.sceneIndex}: ${wc} words (150+ recommended)`);
        // Max 2 characters check
        if (scene.charactersInScene?.length > 2) {
          validationWarnings.push(`Scene ${scene.sceneIndex}: ${scene.charactersInScene.length} characters (max 2)`);
        }
      }
    }

    // ═══ Video Production Training v2.0: Prompt Anatomy Validation ═══
    const anatomyWarnings = validatePromptAnatomy(parsed.scenes);
    validationWarnings.push(...anatomyWarnings);

    return new Response(JSON.stringify({
      scenes: parsed.scenes,
      metadata: {
        system: "DarkPlanner v3",
        totalScenes: scenes.length,
        totalDuration: totalDuration || parsed.scenes.reduce((s: number, sc: any) => s + (sc.sceneDurationSeconds || defaultSceneLen), 0),
        videoStyle: videoStyle || 'cinematográfico',
        contentType,
        charactersCount: characters?.length || 0,
        knowledgeRecordsUsed: topKnowledge.length,
        retentionTechniquesUsed: scriptKnowledge?.length || 0,
        viralPatternsUsed: !!viralPatternsBlock,
        isDocumentary,
        validationWarnings,
        autoFixes,
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
