// ═══════════════════════════════════════════════════════════════
// VIDEO PRODUCTION TRAINING v2.0 — Absorbed into DarkPlanner v3
// Extracted from comprehensive AI Video Production System
// ═══════════════════════════════════════════════════════════════

/**
 * 9-Component Prompt Anatomy Checklist
 * Every prompt should contain these components in order.
 */
export const PROMPT_ANATOMY_CHECKLIST = `
═══ PROMPT ANATOMY — 9 MANDATORY COMPONENTS ═══
Every visual prompt MUST contain these components (in this order):

1. SHOT TYPE: Specific camera distance + angle
   Distances: EWS (extreme wide) → WS (wide) → MS (medium) → CU (close-up) → ECU (extreme close-up)
   Angles: eye level, low angle, high angle, Dutch/canted, bird's eye, worm's eye

2. ACTION: Use GERUND verbs (-ing). Be SPECIFIC about movement:
   ❌ "character enters room"
   ✅ "slowly pushing open wooden door and stepping cautiously into dimly lit room, looking around nervously"
   Include SPEED: slowly, quickly, gradually, suddenly

3. CHARACTERS: Tag format [name] + gender/age + 2-3 key visual traits + current outfit
   Example: "[maria] elderly woman with silver braided hair wearing floral dress"
   Always include expression + body language when face visible

4. SETTING/ENVIRONMENT: Interior/exterior + specific details + background elements
   ❌ "person in room"  ✅ "inside busy coffee shop with wooden tables, exposed bulbs, brick walls, customers blurred in background"

5. LIGHTING: Source + direction + quality + color temperature
   Examples: "warm golden hour sunlight streaming through windows creating long shadows"
   "harsh fluorescent overhead lighting creating sharp shadows, cold atmosphere"

6. MOOD/ATMOSPHERE: Emotional tone + character expression + body language
   Tense, peaceful, melancholic, joyful, mysterious, romantic, suspenseful, intimate, epic, nostalgic

7. AUDIO/ASMR DIRECTION: Primary sound (main action) + secondary (ambient) + tertiary (subtle details)
   Even non-ASMR prompts should mention key sounds for coherent audio direction

8. DIALOGUE (if any): speaking "exact text" — keep SHORT (1-2 sentences max)
   Specify tone: whispering, shouting, crying, speaking softly

9. TECHNICAL SPECS: Style tags matching project visual style
   Include: DOF (shallow/deep), film stock, color science, quality tags
`;

/**
 * Scene Coverage Strategy — how to "film" each narrative moment
 */
export const SCENE_COVERAGE_STRATEGY = `
═══ SCENE COVERAGE STRATEGY (Director's Playbook) ═══
For each narrative scene, think like a film director:

SCENE OPENING → Wide shot or Establishing shot (shows WHERE we are)
DIALOGUE/INTERACTION → Medium shots, Over-shoulder shots
EMOTION/REACTION → Close-up or Extreme close-up
IMPORTANT DETAIL → Extreme close-up (object, hands, eyes)
TRANSITION → Shot that prepares the scene change

PACING RULES:
• Calm/emotional scenes → More close-ups, longer shots, smooth camera movement
• Action/tension scenes → More wide/medium shots, shorter cuts, handheld/dutch angle
• Transitions → Match cut (similar element connects), establishing shot of new location

COVERAGE SEQUENCE EXAMPLE (character arrives home after difficult day):
1. Wide shot — house exterior, character approaching
2. Close-up — hand on doorknob, tired gesture
3. Medium shot — entering, dropping bag on sofa
4. Close-up — face showing exhaustion
5. Wide shot — walking to window
6. Over-shoulder — looking out at city through window
`;

/**
 * Camera Shot Variety Rules — prevent monotonous sequences
 */
export const CAMERA_SHOT_VARIETY_RULES = `
═══ CAMERA SHOT VARIETY (MANDATORY) ═══
RULE: NEVER use the same shot type in 2 consecutive scenes.

ROTATION PATTERN (cycle through these):
ECU (extreme close-up) → WS (wide) → Tracking → Aerial/Drone → MS (medium) → OTS (over-shoulder) → Crane → POV

SELECTION GUIDE:
• Opening a scene → Wide shot or Aerial
• New location → Extreme wide or Establishing
• Dialogue between two → Medium or Over-shoulder
• Intense emotion → Close-up
• Important detail → Extreme close-up
• Action/movement → Tracking shot
• Tension/instability → Handheld or Dutch angle
• Scale/epic reveal → Aerial/Drone or Crane

MANDATORY: Use 5+ different shot types across any sequence of 8+ scenes.
Every 4th scene: "pattern interrupt" — radically different visual approach from previous 3.
`;

/**
 * ASMR Sound Layer Guide — detailed audio layering
 */
export const ASMR_SOUND_LAYER_GUIDE = `
═══ ASMR SOUND LAYERS (3-Tier Audio Design) ═══

Structure audio in 3 layers for each scene:

PRIMARY (main action sound):
• Footsteps on [specific surface]: wooden floor (hollow echoing), tile (sharp clicks), gravel (crunching), wet pavement (splashing)
• Hands touching [material]: leather (soft creaking), paper (crisp rustling), metal (cold clink), fabric (gentle swish)
• Object manipulation: door handle turning (metal click), coffee pouring (liquid cascade), typing (mechanical keystrokes)

SECONDARY (ambient environment):
• Interior: clock ticking, refrigerator humming, fireplace crackling, distant TV murmur
• Exterior: wind through trees, distant traffic, birds calling, rain on roof
• Crowd: indistinct chatter, glasses clinking, footsteps passing

TERTIARY (subtle details):
• Breathing (soft, heavy, panicked)
• Clothing movement (jacket zip, scarf adjusting)
• Environmental micro-sounds (ice cracking, wood settling, water dripping)

FORMAT: "ASMR primary: [action sound with surface detail]; secondary: [ambient]; tertiary: [subtle detail]"

MATERIAL SPECIFICITY MATTERS:
❌ "footsteps" → ✅ "leather boots on wooden floor, hollow echoing, creaking boards"
❌ "pouring drink" → ✅ "coffee pouring into ceramic mug, steam hissing, mug placed on marble with soft clink"
`;

/**
 * Night/Weather/Historical templates for challenging conditions
 */
export const SPECIAL_CONDITIONS_TEMPLATES = `
═══ SPECIAL CONDITIONS — Templates for Challenging Scenes ═══

🌙 NIGHT SCENES:
Always specify artificial light source. Dark scenes are HARD for AI — be extra explicit:
- "dark night scene" + specific light source (street lamp, moonlight, neon signs, phone screen, flashlight)
- Areas of shadow vs light clearly described
- Light color temperature (warm orange street lamp vs cool blue moonlight)
Example: "Wide shot dark night street, [character] walking illuminated by warm orange street lamp overhead creating pool of light, surrounding areas in deep shadow, distant neon store signs providing colored accent lights"

🌧️ RAIN:
"heavy rain falling visible in frame, [character] getting wet, puddles on ground reflecting lights, rain drops on camera lens effect, overcast gray sky, wet surfaces gleaming"

❄️ SNOW:
"snow falling gently, snowflakes visible against dark background, white snow covering ground, cold atmosphere, breath visible in cold air, frosted surfaces"

🌫️ FOG:
"thick fog reducing visibility, mysterious atmosphere, soft diffused lighting, silhouettes barely visible through mist, depth obscured"

💨 WIND:
"strong wind blowing, [character] hair and clothing moving dynamically, trees swaying, leaves flying, dust particles in air"

📜 HISTORICAL PERIOD:
Always mention: decade/era, period-accurate clothing, era-specific architecture, authentic props
Example: "1950s American diner interior, chrome bar stools with red vinyl, checkered floor, jukebox in corner, waitress in period-accurate uniform, vintage posters on walls, warm tungsten lighting"
`;

/**
 * Multi-Character Scene Rules
 */
export const MULTI_CHARACTER_RULES = `
═══ MULTI-CHARACTER SCENE RULES ═══

When 2+ characters share a scene:

1. VISUAL PRIORITY — decide who is MAIN:
   • Who is in foreground? (main character = detailed description)
   • Who is performing the primary action?
   • Who is speaking? (if dialogue)

2. POSITIONING — always specify spatial relationship:
   "[character1] in foreground facing camera, [character2] in background slightly out of focus"
   "[maria] on left side facing right, [joao] on right side facing left, both in conversation"

3. DESCRIPTION LIMIT:
   • Primary character: full description (tag + 2-3 visual traits + outfit + expression)
   • Secondary character: abbreviated (tag + 1 visual trait + relative position)
   • NEVER full descriptions of BOTH — prompt gets too long

4. MAXIMUM 2 CHARACTERS PER PROMPT:
   • If 3+ characters needed, SPLIT into multiple prompts:
     - Prompt A: wide shot showing group positioning
     - Prompt B: close-up of main character reacting
     - Prompt C: over-shoulder from secondary character's POV
`;

/**
 * Character Tag Format — compact reference system
 */
export const CHARACTER_TAG_FORMAT = `
═══ CHARACTER TAG FORMAT (Compact Reference) ═══

In each prompt, reference characters using this compact format:
[tag_name] gender age_range + 2-3 most distinctive visual traits + current outfit

EXAMPLES:
[protagonista] male 30s wearing black leather jacket, strong jaw with stubble
[maria] elderly woman 70s with silver braided hair, wearing floral dress
[cachorro_max] golden retriever with red collar, energetic wagging tail
[detetive] male 40s in beige trench coat, tired weathered face

CONSISTENCY RULE: Use IDENTICAL wording every time a character appears.
❌ NEVER paraphrase: "wearing yellow dress" → "in her yellow outfit" = VIOLATION
✅ ALWAYS: Copy EXACT same words = CORRECT

This tag system COMPLEMENTS the full identity sheet — the tag is the SHORT version used inline,
while the identity sheet is the FULL reference the AI uses to generate the initial description.
`;

/**
 * Prompt Quality Validation — post-generation checks
 */
export const PROMPT_VALIDATION_RULES = `
═══ POST-GENERATION VALIDATION CHECKLIST ═══

For EVERY generated prompt, verify:
☐ Contains specific shot type (not just "shot of...")
☐ Contains action verbs in gerund form
☐ Lighting source specified (not just "good lighting")
☐ Environment has specific materials/textures (not generic)
☐ Character descriptions use consistent wording
☐ Camera is in MOTION (not static for >2s)
☐ No consecutive scenes with same camera angle
☐ Mood/atmosphere explicitly stated
☐ Anti-text suffix present
☐ Word count within target range

TROUBLESHOOTING:
• Character inconsistent → Verify verbatim copy of identity sheet tags
• Wrong scenery → Add more specific interior/exterior + materials + fixed elements
• Unnatural movement → Add "natural [type] movement" + describe physics (weight, momentum)
• Wrong lighting → Specify SOURCE + DIRECTION + QUALITY + COLOR explicitly
• Too generic → Add unique imperfections (scratch, stain, crack) + cultural details
`;

/**
 * Validates prompt anatomy components and returns warnings
 */
export function validatePromptAnatomy(prompts: Array<{ visualPrompt: string; cameraAngle?: string; sceneIndex: number }>): string[] {
  const warnings: string[] = [];
  
  const shotTypeKeywords = ['close-up', 'wide shot', 'medium shot', 'tracking', 'aerial', 'drone', 'pov', 'over-shoulder', 'crane', 'dolly', 'establishing', 'ecu', 'extreme close'];
  const lightingKeywords = ['light', 'lighting', 'golden hour', 'sunlight', 'moonlight', 'neon', 'shadow', 'illuminat', 'backlit', 'rim light', 'volumetric'];
  const actionKeywords = ['ing ', 'walking', 'running', 'looking', 'standing', 'sitting', 'moving', 'reaching', 'turning', 'pushing', 'pulling'];
  
  let prevCameraType = '';
  let consecutiveSameCamera = 0;

  for (const p of prompts) {
    const text = (p.visualPrompt || '').toLowerCase();
    const cam = (p.cameraAngle || '').toLowerCase();
    
    // Check shot type presence
    const hasShot = shotTypeKeywords.some(k => text.includes(k) || cam.includes(k));
    if (!hasShot) warnings.push(`Scene ${p.sceneIndex}: Missing shot type specification`);
    
    // Check lighting
    const hasLighting = lightingKeywords.some(k => text.includes(k));
    if (!hasLighting) warnings.push(`Scene ${p.sceneIndex}: No lighting description detected`);
    
    // Check action verbs
    const hasAction = actionKeywords.some(k => text.includes(k));
    if (!hasAction) warnings.push(`Scene ${p.sceneIndex}: No action/movement verbs detected`);
    
    // Check camera variety (no 3+ consecutive same type)
    const camNormalized = cam.split(/[,\s]/)[0] || 'unknown';
    if (camNormalized === prevCameraType) {
      consecutiveSameCamera++;
      if (consecutiveSameCamera >= 2) {
        warnings.push(`Scene ${p.sceneIndex}: 3+ consecutive scenes with same camera type "${camNormalized}"`);
      }
    } else {
      consecutiveSameCamera = 0;
    }
    prevCameraType = camNormalized;
  }
  
  return warnings;
}

/**
 * Detects if script content involves special conditions
 */
export function detectSpecialConditions(scriptText: string): { hasNight: boolean; hasWeather: boolean; hasHistorical: boolean; hasASMR: boolean } {
  const text = scriptText.toLowerCase();
  return {
    hasNight: /noite|night|escuro|dark|midnight|meia-noite|madrugada|lua|moon/i.test(text),
    hasWeather: /chuva|rain|neve|snow|neblina|fog|tempestade|storm|vento|wind|trovão|thunder/i.test(text),
    hasHistorical: /século|century|antigo|ancient|medieval|renascen|renaissance|império|empire|1\d{3}s|19\d{2}|18\d{2}|era |época/i.test(text),
    hasASMR: /asmr|sons? detalhad|sound design|foley|immersive audio/i.test(text),
  };
}

/**
 * Build conditional training blocks based on content analysis
 */
export function buildConditionalTraining(scriptText: string, enableASMR?: boolean): string {
  const conditions = detectSpecialConditions(scriptText);
  let block = '';
  
  if (conditions.hasNight || conditions.hasWeather || conditions.hasHistorical) {
    block += SPECIAL_CONDITIONS_TEMPLATES;
  }
  
  if (conditions.hasASMR || enableASMR) {
    block += '\n' + ASMR_SOUND_LAYER_GUIDE;
  }
  
  return block;
}
