import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ==========================================
// DOPAMINERGIC MASTER PROMPT BLOCK SYSTEM
// ==========================================
// Each scene prompt follows the "Master Prompt Block" format:
//   "{timestamp}: {camera_move} of {subject} {action}, {environment_detail}"
// This creates hyper-specific, magnetic visual sequences that
// force viewers to stop scrolling in the first 0-3 seconds.

const MASTER_PROMPT_EXAMPLES: Record<string, string> = {
  wojak: `REFERENCE MASTER BLOCK (Wojak Style):
0–3s: wide cinematic shot of yellow wojak character waking up in messy bedroom, morning light through window, camera slowly dollying in
3–5s: extreme close-up of worried yellow wojak face illuminated by phone screen glow, shallow DOF
5–8s: cut to rooftop panoramic establishing shot, dense urban skyline at sunrise, camera slowly pulling away revealing scale
8–12s: medium shot of wojak walking through crowded street, handheld camera tracking, people blurred around him
12–15s: dramatic low angle of wojak looking up at massive building, lens flare, hero moment composition`,

  cinematográfico: `REFERENCE MASTER BLOCK (Cinematic):
0–3s: aerial drone sweeping over dramatic landscape at golden hour, camera rapidly descending toward subject
3–5s: extreme close-up of eyes widening in shock/realization, rack focus from background to face, shallow DOF f/1.4
5–8s: dynamic tracking shot following subject through environment, Steadicam movement, volumetric light rays
8–12s: wide establishing shot revealing the full scope of the situation, ARRI ALEXA look, film grain
12–15s: intimate close-up of hands/details that tell the story, macro lens, emotional lighting`,

  anime: `REFERENCE MASTER BLOCK (Anime):
0–3s: dramatic speed-line zoom into character's shocked face, screen shake, Ufotable-style impact frame
3–5s: atmospheric wide shot with Shinkai-quality sky/clouds, character silhouetted, parallax depth layers
5–8s: dynamic action cut with sakuga-quality movement, camera rotating around subject, rim lighting
8–12s: emotional close-up with tear/sweat detail, cel-shading, soft glow particles floating
12–15s: bird's eye establishing shot pulling out to reveal full scene scale, MAPPA color grading`,

  '3d': `REFERENCE MASTER BLOCK (3D Pixar):
0–3s: dramatic camera push through environment into character's face, Pixar-quality subsurface scattering
3–5s: over-the-shoulder shot revealing new information, depth of field blur, global illumination
5–8s: dynamic tracking shot with character running/moving, PBR materials, motion blur, 8K textures
8–12s: emotional medium shot, expressive face animation, rim light highlighting silhouette
12–15s: wide cinematic pullback showing full environment, volumetric fog, sunset lighting`,

  '2d': `REFERENCE MASTER BLOCK (2D Motion):
0–3s: bold graphic zoom into central element, Kurzgesagt-style flat design, color burst transition
3–5s: info-reveal with animated icons/diagrams flowing in from sides, smooth 24fps easing
5–8s: split composition showing contrast/comparison, parallax depth layers, bold color palette
8–12s: dynamic element assembly building the key visual, kinetic typography vibes
12–15s: satisfying zoom-out revealing full picture, all elements connected, loop-ready composition`,

  dark: `REFERENCE MASTER BLOCK (Dark/Noir):
0–3s: slow reveal through darkness, single light source illuminating subject, deep shadows, fog machine
3–5s: extreme close-up of detail (eye, hand, object), neon accent lighting, Blade Runner 2049 palette
5–8s: wide shot of oppressive environment, crushed blacks, rain/particles, silhouette composition
8–12s: dutch angle medium shot creating unease, flickering light, desaturated with single color accent
12–15s: dramatic pullback into complete darkness, subject disappearing, loop back to opening light`,

  realista: `REFERENCE MASTER BLOCK (Photorealistic):
0–3s: handheld documentary-style close-up catching a raw emotional moment, Sony A7R V, natural light
3–5s: shallow DOF portrait with bokeh, 85mm f/1.2, golden hour sidelight, authentic expression
5–8s: tracking shot through real environment, steadicam feel, available light, 8K detail
8–12s: intimate detail shot (hands, textures, objects), macro quality, natural color grading
12–15s: wide environmental portrait, subject in context, photojournalistic composition`,

  comic: `REFERENCE MASTER BLOCK (Comic/HQ):
0–3s: dramatic panel-burst composition, character breaking through frame, bold ink outlines, impact lines
3–5s: close-up with halftone shading, speech bubble composition space, saturated primary colors
5–8s: dynamic action pose, multiple motion lines, comic panel layout transition
8–12s: emotional panel with dramatic lighting, cross-hatching shadows, high contrast
12–15s: splash page composition revealing full scene, bold outlines, Ben-Day dots texture`,

  stickmen: `REFERENCE MASTER BLOCK (Stickmen):
0–3s: simple stick figure in exaggerated pose of surprise/shock, clean white background, bold lines
3–5s: rapid sequence of stick figures showing action, minimalist humor, expressive despite simplicity
5–8s: environment drawn in with simple lines, stick figure reacting, comedic timing in composition
8–12s: split frame showing cause/effect with stick figures, visual punchline setup
12–15s: final stick figure pose for reaction/loop, clean composition, meme-ready framing`,

  whiteboard: `REFERENCE MASTER BLOCK (Whiteboard):
0–3s: hand drawing the first element rapidly, marker on whiteboard, real-time illustration feel
3–5s: diagram expanding with arrows and connections, educational reveal, clean hand-drawn style
5–8s: key concept illustrated with bold underline/circle, emphasis through drawing technique
8–12s: full diagram visible, hand adding final details, satisfying completion
12–15s: camera pulling back to show full whiteboard, all concepts connected, zoom to key point for loop`,

  animal_chase: `REFERENCE MASTER BLOCK (Animal Chase/Survival — Hyper-Realistic):
0–3s: EXTREME CLOSE-UP on terrified animal eyes reflecting danger, 120fps slow-motion, visible fur texture, sweat/water droplets, shallow DOF f/1.4, ARRI ALEXA Mini LF 8K, heartbeat sound design
3–5s: WIDE EPIC shot revealing the threat — flood water/predator/angry person — dramatic volumetric golden hour lighting, dust particles flying, animal sprinting into frame, handheld camera shake
5–8s: LOW ANGLE tracking shot of animal running at full speed, mud splashing, paws hitting ground in slow-motion, debris flying, National Geographic meets Hollywood thriller cinematography
8–12s: AERIAL drone chase POV following animal through landscape, epic scale reveal of danger behind, stormy skies or golden hour, desaturated color grading with warm punchy highlights
12–15s: EXTREME CLOSE-UP animal looks back in fear/determination, then turns forward — snap cut to wide shot of escape route, perfect loop back to opening eye shot`,
};

// Dopaminergic timing rules based on duration category
const DOPAMINE_TIMING = {
  micro: { // 15-25s
    hookWindow: '0-1.5s',
    hookDuration: 1.5,
    sceneDuration: '2-3s per scene',
    minScenes: 5,
    maxScenes: 8,
    rules: `MICRO-SHORT DOPAMINE RULES (15-25s):
- 0-1.5s: NUCLEAR HOOK — single most shocking/curious visual, must stop scrolling INSTANTLY
- Every scene = 2-3 seconds MAX. RAPID FIRE cuts. Zero filler frames.
- You MUST generate AT LEAST 5-7 scenes even for 15s videos. Each scene = a NEW visual.
- Each cut = dopamine spike (new angle, new revelation, new emotion)
- Final 1.5s = PERFECT LOOP back to opening shot
- ONE idea only. ONE emotion. MAXIMUM density.
- Camera moves: rapid zooms, whip pans, snap cuts ONLY
- No establishing shots longer than 2s — audience is GONE by 3s if bored`,
  },
  flash: { // 25-40s
    hookWindow: '0-2s',
    hookDuration: 2,
    sceneDuration: '3-4s per scene',
    minScenes: 7,
    maxScenes: 10,
    rules: `FLASH-SHORT DOPAMINE RULES (25-40s):
- 0-2s: MAGNETIC HOOK — wide cinematic + extreme close-up combo in 2 seconds
- Generate 7-10 scenes with 3-4s each. FAST PACING. Every cut = new visual.
- 3-8s: PATTERN INTERRUPT — completely unexpected angle or revelation
- Every 6s: NEW dopamine trigger (visual shock, information bomb, emotional shift)
- Escalating intensity: each scene more dramatic than the last
- 2-second CLIFFHANGER before final reveal
- Final scene: LOOP MAGNET — visual/emotional callback to scene 1
- Camera variety: minimum 7 different angles, NEVER repeat consecutively`,
  },
  story: { // 40-60s
    hookWindow: '0-2s',
    hookDuration: 2,
    sceneDuration: '3-5s per scene',
    minScenes: 10,
    maxScenes: 15,
    rules: `STORY-SHORT DOPAMINE RULES (40-60s):
- 0-2s: FLASHFORWARD — show the climax/most dramatic moment FIRST
- Generate 10-15 scenes with 3-5s each. DENSE visual storytelling.
- 3-6s: REWIND — "Let me tell you how we got here" — reset with establishing context
- Every 6-8s: OPEN LOOP — introduce unanswered question to prevent scroll-away
- 20-25s: MIDPOINT TWIST — unexpected turn that re-hooks anyone about to leave
- Final 3s: EMOTIONAL PAYOFF + LOOP setup
- Camera progression: intimate → wide → intimate → wide (breathing rhythm)
- Emotional arc: shock → curiosity → empathy → revelation → awe → loop`,
  },
};

function getDurationCategory(dur: number): 'micro' | 'flash' | 'story' {
  if (dur <= 25) return 'micro';
  if (dur <= 40) return 'flash';
  return 'story';
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, durationSeconds, videoStyle, characters, customStyleNotes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    const dur = parseInt(durationSeconds) || 45;
    const category = getDurationCategory(dur);
    const timing = DOPAMINE_TIMING[category];
    // For Shorts: 1 scene every 2-3s for micro, 3-4s for flash, 3-5s for story
    const sceneDivisor = category === 'micro' ? 2.5 : category === 'flash' ? 3.5 : 4;
    const sceneCount = Math.max(timing.minScenes, Math.min(timing.maxScenes, Math.round(dur / sceneDivisor)));

    // Parallel data fetches
    const [promptKnowledgeRes, hooksRes, attentionRes] = await Promise.all([
      sb.from("scene_prompt_knowledge")
        .select("prompt_template,category,title")
        .order("viral_score", { ascending: false }).limit(5),
      sb.from("hook_library")
        .select("hook_text,hook_type,retention_score")
        .order("retention_score", { ascending: false }).limit(5),
      sb.from("attention_engineering")
        .select("pattern_name,technique,category")
        .order("retention_impact", { ascending: false }).limit(5),
    ]);

    const knowledgeBlock = (promptKnowledgeRes.data || []).map((r: any) =>
      `[${r.category}] ${r.title}: ${r.prompt_template.slice(0, 200)}`
    ).join("\n");

    const hooksBlock = (hooksRes.data || []).map((r: any) =>
      `🪝 [${r.hook_type}] ${r.hook_text} (retenção: ${r.retention_score}%)`
    ).join("\n");

    const attentionBlock = (attentionRes.data || []).map((r: any) =>
      `⚡ ${r.pattern_name}: ${r.technique}`
    ).join("\n");

    // Character descriptions
    const charBlock = Array.isArray(characters) && characters.length > 0
      ? characters.map((c: any) =>
        `👤 ${c.name}: ${c.visual_prompt || JSON.stringify(c.visual_attributes || {})}`
      ).join("\n")
      : '';

    // Get style-specific master prompt reference
    const styleKey = (videoStyle || 'cinematográfico').toLowerCase();
    const masterRef = MASTER_PROMPT_EXAMPLES[styleKey] || MASTER_PROMPT_EXAMPLES['cinematográfico'];

    const systemPrompt = `You are a WORLD-CLASS SHORT-FORM VIDEO DIRECTOR specializing in DOPAMINERGIC content.
Your scenes MUST make viewers STOP SCROLLING in the first 0-3 seconds.

📱 FORMAT: VERTICAL 9:16 — ${dur} second Short
🎬 STYLE: ${styleKey.toUpperCase()}
📊 CATEGORY: ${category.toUpperCase()} (${dur}s)
${customStyleNotes ? `✨ USER NOTES: ${customStyleNotes}` : ''}

═══════════════════════════════════════
🧠 DOPAMINERGIC SCIENCE — FOLLOW EXACTLY:
═══════════════════════════════════════
${timing.rules}

═══════════════════════════════════════
🎬 MASTER PROMPT BLOCK FORMAT
═══════════════════════════════════════
Each visualPrompt MUST follow this EXACT cinematic format:

${masterRef}

CRITICAL FORMAT RULES:
1. Each visualPrompt = ONE continuous shot description with SPECIFIC camera move
2. Start with camera type: "wide cinematic shot", "extreme close-up", "aerial drone", "tracking shot", "low angle", "dutch angle", "POV shot"
3. Include SPECIFIC details: lighting (golden hour, neon, moonlight), lens (shallow DOF, f/1.4, macro), movement (dollying in, pulling away, whip pan)
4. Character actions must be EMOTIONALLY CHARGED — no neutral poses
5. Environment details create ATMOSPHERE — not just backdrop
6. ALWAYS end with: (do not include any platform logos, watermarks, text, or signatures in the image; render clean final output, no UI overlays)

═══════════════════════════════════════
🪝 VIRAL HOOKS DATABASE:
═══════════════════════════════════════
${hooksBlock || 'Use scroll-stopping techniques: shock value, curiosity gap, visual spectacle'}

═══════════════════════════════════════
⚡ ATTENTION ENGINEERING:
═══════════════════════════════════════
${attentionBlock || 'Pattern interrupts every 8s, dopamine stacking, emotional whiplash'}

${knowledgeBlock ? `\n📚 VISUAL REFERENCES:\n${knowledgeBlock}\n` : ''}
${charBlock ? `\n👥 CHARACTERS:\n${charBlock}\n` : ''}

═══════════════════════════════════════
🗺️ SEMANTIC VISUAL MAPPING — CRITICAL!
═══════════════════════════════════════
EVERY scene MUST visually represent EXACTLY what the narrator is saying at that moment.
DO NOT create generic shots. Instead, MAP narration to CONCRETE visuals:

EXAMPLE: If narrator says "No Egito antigo foi achado isso, esqueça tudo que aprendeu na escola sobre o Egito":
- Scene 1 (0-2s): Aerial drone over Egyptian pyramids at sunset, sand particles floating, golden hour
- Scene 2 (2-4s): Close-up of ancient hieroglyphics being illuminated by torch, dust particles, dark tomb
- Scene 3 (4-7s): Student in classroom looking shocked at textbook about Egypt, fluorescent lights, rack focus
- Scene 4 (7-9s): Man watching documentary about Egypt on TV, screen glow on face, living room at night  
- Scene 5 (9-12s): Dramatic aerial shot diving INTO the Great Sphinx at golden hour, sand storm approaching
- Scene 6 (12-14s): Extreme close-up of archaeological dig revealing golden artifact, hands brushing sand
- Scene 7 (14-15s): Wide shot of pyramids with mysterious light beam, loop back to scene 1 composition

EACH SCENE = A DIFFERENT VISUAL CONTEXT that illustrates the narration.
Mix: landscapes, close-ups, people reacting, documentary footage style, dramatic reveals.

Generate EXACTLY ${sceneCount} scenes. Each scene = 2-4 seconds MAX.

Return a VALID JSON array with this EXACT structure:
[
  {
    "sceneIndex": 1,
    "startTime": 0,
    "endTime": 2.5,
    "sceneDurationSeconds": 2.5,
    "narrativeText": "spoken text for this scene",
    "narrativeSummary": "1-line emotional beat summary",
    "visualPrompt": "MASTER PROMPT BLOCK format: {camera_type} of {subject} {emotional_action}, {environment_detail}, {lighting}, {lens_spec}, {camera_movement}, vertical 9:16 composition (do not include any platform logos, watermarks, text, or signatures in the image; render clean final output, no UI overlays)",
    "cameraAngle": "specific: extreme close-up / wide cinematic / aerial drone / low angle dutch / tracking handheld / POV first-person / bird eye / macro detail",
    "cameraMove": "specific: dolly in / pull away / whip pan right / snap zoom / orbit 180° / crane up / steadicam track",
    "lensSpec": "specific: 85mm f/1.2 shallow DOF / 24mm wide angle / 50mm standard / 100mm macro / anamorphic 2x",
    "lighting": "specific: golden hour sidelight / neon accent / single source dramatic / volumetric rays / moonlight blue",
    "mood": "tense / exciting / mysterious / shocking / heartbreaking / triumphant / eerie / euphoric",
    "emotionalBeat": "hook / curiosity / pattern-interrupt / escalation / reveal / twist / climax / loop",
    "dopamineTrigger": "what makes viewer's brain release dopamine in this scene",
    "transitionNote": "hard cut / whip pan / snap zoom / glitch / match cut / J-cut",
    "negativePrompt": "blurry, horizontal composition, 16:9, letterbox, watermark, text, titles, captions, logos, signatures, UI overlays, low quality, platform logos"
  }
]

SCENE 1 IS EVERYTHING. If scene 1 doesn't STOP THE SCROLL, the video FAILS.
The LAST scene must create an irresistible LOOP back to scene 1.
NEVER generate fewer than ${sceneCount} scenes. Each scene = 2-4 seconds.`;

    const res = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate ${sceneCount} DOPAMINERGIC scenes (${category} category, ${dur}s) using Master Prompt Block format for this Short:\n\n${script}\n\nStyle: ${styleKey}\nReturn ONLY the JSON array. Each visualPrompt must be a vivid, timestamped cinematic shot description.` }
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return errResp("Rate limit.", 429);
      if (res.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error("Scene generation failed: " + res.status);
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

    // Post-process: ensure anti-watermark suffix on every visualPrompt
    const antiSuffix = "(do not include any platform logos, watermarks, text, or signatures in the image; render clean final output, no UI overlays)";
    for (const scene of scenes) {
      if (scene.visualPrompt && !scene.visualPrompt.includes("no UI overlays")) {
        scene.visualPrompt = scene.visualPrompt.replace(/\s*$/, ` ${antiSuffix}`);
      }
      // Ensure negative prompt is comprehensive
      if (!scene.negativePrompt || scene.negativePrompt.length < 30) {
        scene.negativePrompt = "blurry, horizontal composition, 16:9, letterbox, watermark, text, titles, captions, logos, signatures, UI overlays, low quality, platform logos";
      }
    }

    return new Response(JSON.stringify({
      scenes,
      sceneCount: scenes.length,
      format: "9:16",
      durationCategory: category,
      dopamineProfile: {
        hookWindow: timing.hookWindow,
        scenePacing: timing.sceneDuration,
        technique: "Master Prompt Block",
      },
    }), {
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
