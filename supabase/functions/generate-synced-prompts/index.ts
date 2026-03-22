import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { applyVeo3PolicyFilter, VEO3_POLICY_PROMPT, ANTI_TEXT_SUFFIX } from "../_shared/veo3-policy-filter.ts";

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
                      environment: {
                        type: "object",
                        description: "ENVIRONMENT IDENTITY SHEET — Detailed scene/location description for absolute visual consistency across scenes",
                        properties: {
                          locationName: { type: "string", description: "Specific location name: 'Ancient Egyptian tomb chamber', 'Tokyo neon-lit alley', 'Deep ocean trench at 3000m'" },
                          locationType: { type: "string", description: "Category: interior, exterior, underwater, aerial, underground, space, microscopic" },
                          timeOfDay: { type: "string", description: "Precise time: 'golden hour (6:45pm)', 'blue hour pre-dawn', 'midnight', 'harsh noon', 'overcast afternoon', 'twilight'" },
                          weather: { type: "string", description: "Atmospheric conditions: 'light rain with mist', 'dense fog', 'clear starry sky', 'storm approaching', 'snow flurries', 'humid tropical heat haze'" },
                          lightSource: { type: "string", description: "Primary light: 'low sun from west at 15°', 'single tungsten bulb overhead', 'bioluminescent organisms', 'firelight from left', 'neon signs RGB'" },
                          shadowDirection: { type: "string", description: "Shadow cast direction: 'long shadows from camera-left at 30°', 'directly below (noon)', 'dramatic diagonal right-to-left'" },
                          shadowIntensity: { type: "string", description: "Shadow quality: 'deep noir blacks', 'soft diffused', 'harsh crisp edges', 'dappled through leaves', 'volumetric through blinds'" },
                          colorTemperature: { type: "string", description: "Kelvin + feel: '2700K warm amber', '5600K neutral daylight', '7500K cold blue', '3200K tungsten warm', 'mixed warm/cool contrast'" },
                          dominantColors: { type: "array", items: { type: "string" }, description: "3-5 dominant colors: ['deep teal', 'burnt sienna', 'ash gray', 'gold accents']" },
                          atmosphericElements: { type: "string", description: "Particles/effects: 'dust motes in light beams', 'volcanic ash', 'fireflies', 'rain droplets on lens', 'embers floating upward', 'underwater caustics'" },
                          surfaceTextures: { type: "string", description: "Key textures: 'wet cobblestone reflections', 'rough sandstone walls', 'polished marble floor', 'rusted metal panels', 'mossy ancient stone'" },
                          depthLayers: { type: "string", description: "Z-depth composition: 'FG: grass blades out of focus | MID: subject sharp | BG: mountains in atmospheric haze'" },
                          framingComposition: { type: "string", description: "Composition rule: 'rule of thirds, subject left-third', 'centered symmetry', 'golden ratio spiral', 'leading lines from bottom-left', 'frame within frame through doorway'" },
                          architecturalDetails: { type: "string", description: "Built environment: 'Gothic arches with flying buttresses', 'minimalist concrete brutalism', 'ornate Baroque gilding'" },
                          natureLandscape: { type: "string", description: "Natural setting: 'dense tropical canopy', 'arid desert dunes', 'volcanic terrain with lava flows', 'coral reef with schools of fish'" },
                          propsDressing: { type: "string", description: "Set dressing: 'scattered ancient scrolls, candles melting', 'modern tech screens glowing', 'war-torn debris, smoke'" },
                          continuityNotes: { type: "string", description: "Scene-to-scene consistency: 'SAME location as Scene 3 but camera moved 90° right', 'Time progressed 2 hours — shadows now longer', 'Same room, lights now off — only moonlight'" },
                        },
                        required: ["locationName", "locationType", "timeOfDay", "weather", "lightSource", "shadowDirection", "shadowIntensity", "colorTemperature", "dominantColors", "atmosphericElements", "surfaceTextures", "depthLayers", "framingComposition"],
                        additionalProperties: false,
                      },
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
            content: `You are a WORLD-CLASS visual director creating prompts for Google Veo 3 video generation model, trained on the DarkPlanner professional prompt system. Your prompts produce Netflix/Disney/Marvel-grade cinematic video.

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

ADAPTATION TECHNIQUES (use these instead):
• VIOLENCE → TENSION/CONSEQUENCE: "aggressive body language, clenched fists, no physical contact shown"
• WEAPONS → IMPLICATION: "defensive stance, hand at holster, no weapons visible"
• DEATH → MEMORIAL/AFTERMATH: "white sheet covering shape, grief visible, respectful framing"
═══════════════════════════════════════

═══ DARKPLANNER v3 — COMPLETE PROMPT RULES ═══

1. PROMPT LENGTH: 150-250 words per prompt (MINIMUM 150). Detailed prompts = better Veo3 output.
${isDocumentary ? '\n   DOCUMENTARY MODE ACTIVE: Focus on locations/atmosphere. 1 prompt per ~60s. No character identity sheets needed.\n' : ''}
2. CHARACTER CONSISTENCY (MOST IMPORTANT RULE):
   - Clothing/appearance COPIED WORD-FOR-WORD from identity sheet
   - ❌ NEVER paraphrase: "wearing yellow dress" → "in her yellow outfit" = WRONG
   - ✅ ALWAYS: Copy EXACT same wording every time = CORRECT
   - Max 2 characters per prompt (split into multiple if 3+ needed)

3. MANDATORY MOVEMENT in EVERY prompt (at least 2 types):
   CHARACTER: walking, turning, reaching, breathing heavily, trembling
   CAMERA: pushing in, pulling back, panning, circling, tracking
   ENVIRONMENT: wind blowing, particles floating, water flowing, flames flickering

4. ENVIRONMENT DETAIL (prevent white/buggy backgrounds):
   ALWAYS include: specific location + materials, visible surroundings, light source + direction, textures, small props
   ❌ WRONG: "[Character] standing talking"
   ✅ RIGHT: "[Character] standing in modest kitchen with chipped tile counter, old refrigerator visible, window showing houses outside"

VEO 3 MASTER PROMPT FORMULA v2.0 (use for EVERY prompt):
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

1. DYNAMIC SCENE DURATION: Veo3 generates ONLY 8-second clips:
   - EVERY scene = 8 seconds (this is a Veo3 hard limit)
   - For ${totalDuration > 0 ? `${totalDuration}s audio → MINIMUM ${Math.ceil((totalDuration || 80) / 8)} scenes` : 'estimate from text'}
   - HOOK SCENE (Scene 1): 8s — MOST spectacular, impossible-to-ignore opening shot
   - Calculate startTime/endTime cumulatively in 8-second increments
   - FULL COVERAGE: every second of audio must have a corresponding visual scene

2. SCENE 1 = HOOK (MAGNETIC HOOK FORMULA): Must combine:
   - MYSTERY (what is this?) — partial reveal, obscured subject
   - SCALE (epic/impossible) — massive landscape, extreme macro
   - MOTION (dynamic camera) — dolly, crane, or drone movement
   - DETAIL (micro-textures that prove quality) — pores, dust, water droplets
   Prefix with "HOOK SCENE —"

3. PROMPT LENGTH: 150-250 words. Use EXACT professional film terminology that Veo3 understands best:
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

11. ═══ ENVIRONMENT IDENTITY SHEET — NETFLIX-GRADE SET DESIGN ═══
    For EVERY scene, generate a COMPLETE "environment" object with:
    - locationName: SPECIFIC place ("crumbling Roman colosseum at dusk", not "building")
    - locationType: interior/exterior/underwater/aerial/underground/space
    - timeOfDay: PRECISE ("golden hour 6:30pm", "3am moonlight", "overcast noon")
    - weather: atmospheric conditions with sensory detail
    - lightSource: PRIMARY light source with angle/direction ("low sun from west at 15°")
    - shadowDirection: WHERE shadows fall ("long shadows camera-left at 30°")
    - shadowIntensity: shadow CHARACTER ("deep noir blacks", "soft diffused", "harsh crisp edges")
    - colorTemperature: Kelvin value + feeling ("2700K warm amber", "7500K cold blue")
    - dominantColors: 3-5 specific colors that define the palette
    - atmosphericElements: particles, effects ("dust motes in light beams", "underwater caustics")
    - surfaceTextures: key surface details ("wet cobblestone reflections", "rusted metal panels")
    - depthLayers: Z-depth composition ("FG: grass out of focus | MID: subject sharp | BG: mountains in haze")
    - framingComposition: composition rule ("rule of thirds subject left", "golden ratio spiral")
    - continuityNotes: HOW this scene connects visually to adjacent scenes

    ⚠️ CONTINUITY RULES:
    - If consecutive scenes share the SAME location, use IDENTICAL locationName/locationType/surfaceTextures
    - Track time progression: shadows get longer, light temperature shifts
    - If a character moves rooms, the NEW room must be described from scratch
    - Weather changes must be GRADUAL (not sunny→storm in one cut)
    - Color palette should evolve smoothly — no jarring shifts unless narratively motivated

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
            content: `Generate ${scenes.length} NETFLIX/DISNEY-GRADE Veo3 video prompts.
Total audio: ${totalDuration > 0 ? `${totalDuration}s` : 'estimate from text'}
CRITICAL: Each Veo3 clip = 8 seconds. Minimum scenes needed: ${Math.ceil((totalDuration || 80) / 8)}
Style: ${videoStyle || 'cinematográfico'}
Niche: ${niche || 'general'}
Language context: ${language || 'português'}

ABSOLUTE RULES:
1. Scene 1 = HOOK — most visually stunning shot possible
2. ZERO text/subtitles/captions in ANY prompt
3. Every prompt ends with "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"
4. EACH scene's visual MUST match what is being NARRATED in that text block
5. Read the scene text and create a visual that REPRESENTS exactly what is being said
6. Do NOT use generic/disconnected visuals — every scene must illustrate its narration
7. Apply DarkPlanner v3: movement trio + environment detail + policy compliance

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

    // ═══ DarkPlanner v3 Post-Processing: Trigger Word Scanner + Auto-Validation ═══
    const TRIGGER_WORDS_MAP: Record<string, string> = {
      'gun': 'defensive stance', 'weapon': 'tactical equipment', 'knife': 'sharp tool',
      'blood': 'dark stain', 'dead': 'covered shape on ground', 'corpse': 'white sheet covering form',
      'naked': 'draped in fabric', 'punch': 'aggressive forward motion', 'kick': 'defensive movement',
      'attack': 'confrontational stance', 'drugs': 'mysterious substance',
    };
    const validationWarnings: string[] = [];
    const autoFixes: string[] = [];
    const ANTI_TEXT = "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";

    for (const scene of parsed.scenes) {
      if (typeof scene.visualPrompt === 'string') {
        // Trigger word auto-fix
        for (const [tw, replacement] of Object.entries(TRIGGER_WORDS_MAP)) {
          const regex = new RegExp(`\\b${tw}\\b`, 'gi');
          if (regex.test(scene.visualPrompt)) {
            scene.visualPrompt = scene.visualPrompt.replace(regex, replacement);
            autoFixes.push(`Scene ${scene.sceneIndex}: "${tw}" → "${replacement}"`);
          }
        }
        // Anti-text suffix
        if (!scene.visualPrompt.includes("no subtitles")) {
          scene.visualPrompt += ` ${ANTI_TEXT}`;
        }
        // Word count check
        const wc = scene.visualPrompt.split(/\s+/).length;
        if (wc < 100) validationWarnings.push(`Scene ${scene.sceneIndex}: ${wc} words (150+ recommended)`);
        // Max 2 characters check
        if (scene.charactersInScene?.length > 2) {
          validationWarnings.push(`Scene ${scene.sceneIndex}: ${scene.charactersInScene.length} characters (max 2)`);
        }
        // Remove leaked numbering
        scene.visualPrompt = scene.visualPrompt.replace(/^(Scene|Cena|Prompt)\s*\d+\s*[:—-]\s*/i, '');
      }
    }

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
