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
═══ SPECIAL CONDITIONS — Production-Ready Visual Templates ═══

Each template below is a COMPLETE block you MUST inject when the condition is detected.
Copy the relevant descriptors VERBATIM into your prompt, then customize character/location specifics.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌙 NIGHT SCENES (3 Sub-Templates)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL: Dark scenes are the HARDEST for AI video. Be MAXIMALLY explicit about light sources.

NIGHT-URBAN:
  Lighting: warm orange sodium street lamps creating isolated pools of light on wet asphalt, cool blue moonlight on rooftops, distant neon signs (magenta, cyan, amber) providing colored rim lights, car headlights sweeping intermittent beams
  Environment: reflective wet pavement mirroring colored lights, steam rising from manhole covers catching light, deep black shadows between lamp pools, lit windows in buildings providing background warmth
  Technical: lifted shadows to 15%, visible grain, anamorphic lens flares from point light sources, shallow DOF f/1.4

NIGHT-RURAL:
  Lighting: bright full moon casting cool blue-silver light, single warm yellow porch light or bonfire as primary, stars visible in sky, fireflies or ambient bioluminescence
  Environment: silhouetted tree lines against dark blue sky, grass catching moonlight highlights, distant house lights as orange pinpoints, ground texture visible only in lit areas
  Technical: high ISO grain aesthetic, long exposure feel, deep blacks with blue tint, mist catching moonbeams

NIGHT-INTERIOR:
  Lighting: practical lamp casting warm pool on desk/table, TV/monitor screen casting cold blue on character face, ambient city light through window creating geometric shadows, candle flame (warm orange, flickering micro-shadows)
  Environment: most of room in shadow, lit objects hyperdetailed, dark corners suggesting depth, reflective surfaces (glasses, screens, polished wood) catching light points
  Technical: mixed color temperature (warm practical + cool screen), visible light falloff, intimate shallow DOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌧️ RAIN (3 Intensity Levels)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LIGHT-RAIN (Drizzle):
  Visual: fine misty rain barely visible except against dark backgrounds and light sources, damp surfaces with subtle sheen, occasional droplet on camera lens, overcast flat gray sky diffusing all shadows
  Sound layer: gentle patter on surfaces, wet footsteps, distant gutter dripping
  Character: slightly damp hair, collar turned up, unhurried pace

HEAVY-RAIN (Downpour):
  Visual: thick visible rain streaks catching light, explosive splashing on ground, deep puddles reflecting and distorting lights, rain curtain reducing background visibility by 40%, water streaming down windows and surfaces, soaked clothing clinging to body
  Sound layer: roaring rain on surfaces, splashing footsteps, thunder rumbles, water rushing in gutters
  Character: completely soaked, squinting, hair plastered to face, clothes darkened by water
  Technical: high shutter speed to freeze drops OR low shutter for streak effect, backlit rain against dark background for maximum visibility

STORM:
  Visual: violent horizontal rain, lightning flashes illuminating entire scene in cold blue-white (0.5s), trees bending, debris in air, extreme puddle splashing, sky dark greenish-gray
  Sound layer: howling wind, cracking thunder, rain hammering metal surfaces, distant alarm
  Technical: lightning as dramatic key light (intermittent), handheld camera shake, Dutch angle for instability

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❄️ SNOW (2 Templates)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GENTLE-SNOW:
  Visual: large soft snowflakes drifting slowly, white ground cover reflecting ambient light (scene appears brighter), bare tree branches with snow accumulation, frosted window panes with ice crystal patterns, visible breath condensation
  Color: desaturated palette, blue-white highlights, warm interior lights contrasting cold exterior
  Character: bundled in layers, rosy cheeks and nose tip, steaming breath at each exhale, careful footsteps crunching in snow
  Sound layer: muffled ambient (snow absorbs sound), crisp footstep crunches, wind whisper, distant church bell

BLIZZARD:
  Visual: dense horizontal snow reducing visibility to 3-5 meters, whiteout conditions, character struggling against wind, snow accumulating on clothing in real-time, ice forming on exposed surfaces
  Color: near-monochrome white-gray, blue shadows, zero warm tones unless artificial light
  Technical: shallow DOF to emphasize depth lost in snow, particle density high, wind-driven snow direction consistent frame-to-frame

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌫️ FOG & MIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOG:
  Visual: thick volumetric fog reducing visibility progressively — foreground clear, mid-ground hazy, background invisible. Objects fade into white/gray. Light sources create dramatic god rays and halos through fog. Silhouettes emerge gradually.
  Lighting: diffused omnidirectional (no hard shadows), light sources visible as bright orbs with halos, headlights create cone beams through fog
  Atmosphere: mysterious, isolating, sounds muffled, claustrophobic despite open space
  Technical: deep DOF (everything soft anyway), desaturated colors, high key for daylight fog, low key for night fog

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💨 WIND (2 Templates)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GENTLE-WIND:
  Visual: hair flowing softly, light fabric rippling, leaves tumbling lazily, grass swaying in waves, curtains billowing through open window
  Technical: slow motion 60fps captures subtle movement, backlit particles (dust, pollen) visible in air

STRONG-WIND:
  Visual: hair whipping violently, coat flapping aggressively, trees bending 20-30 degrees, papers and small debris flying, character bracing and leaning into wind, squinting eyes
  Sound layer: howling wind, rattling windows, flapping fabric, whistling through gaps
  Technical: handheld slight shake suggesting wind hitting camera, particles flying past lens

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 HISTORICAL PERIODS (5 Era Templates)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANCIENT (Egypt/Greece/Rome, pre-500 AD):
  Architecture: stone columns, marble floors, terracotta walls, oil lamp niches, open courtyards, mosaic floors
  Clothing: draped fabric (togas, tunics, linen wraps), sandals, gold jewelry, leather armor
  Props: clay pots, scrolls, bronze weapons, wax tablets, amphoras, torches
  Lighting: fire-based only — torches, oil lamps, bonfires, natural sunlight through openings
  Color: earth tones (ochre, terracotta, olive), gold accents, deep blues for royalty
  Film aesthetic: Ridley Scott color grade, warm desaturated, grain

MEDIEVAL (500-1500 AD):
  Architecture: stone castles, thatched-roof villages, Gothic cathedrals, timber frames, cobblestone
  Clothing: chainmail, tunics, cloaks with clasps, leather boots, head coverings
  Props: swords, shields, goblets, wooden tables, candelabras, hay, horses
  Lighting: candlelight (warm flickering), fireplace, narrow window shafts of daylight, torches in sconces
  Color: muted earth palette, deep reds and golds for nobility, browns and grays for commoners
  Film aesthetic: desaturated, cool shadows, warm fire highlights, film grain heavy

RENAISSANCE/BAROQUE (1400-1700):
  Architecture: ornate palaces, domed ceilings with frescoes, marble staircases, grand halls, arched windows
  Clothing: elaborate gowns, ruffs, doublets, velvet, silk, lace details, feathered hats
  Props: oil paintings, candelabras, quill and ink, globes, lutes, rich tapestries
  Lighting: Rembrandt/Caravaggio chiaroscuro — single strong directional light, deep dramatic shadows
  Color: rich palette (deep red, gold, emerald, royal blue), warm candlelight dominance

VICTORIAN/INDUSTRIAL (1837-1901):
  Architecture: brick factories, gas-lit streets, ornate parlors, iron railings, cobblestone, fog-shrouded alleys
  Clothing: top hats, long coats, corsets, high collars, pocket watches, parasols, gloves
  Props: gas lamps, steam engines, horse carriages, typewriters, leather-bound books, telegraph
  Lighting: gas lamp warm yellow, overcast daylight through soot-streaked windows, candlelight
  Color: sepia-warm palette, industrial grays, green-tinted shadows, copper highlights
  Film aesthetic: period drama color grade, soft diffusion, vignetting

MID-20TH CENTURY (1940s-1960s):
  Architecture: art deco buildings, chrome diners, suburban houses, neon signs, drive-in theaters
  Clothing: fedoras, swing dresses, leather jackets, poodle skirts, military uniforms, cat-eye glasses
  Props: rotary phones, jukeboxes, vintage cars (fins and chrome), tube radios, vinyl records, cigarettes in holders
  Lighting: warm tungsten interior, neon exterior, dramatic noir shadows for 40s, bright Technicolor for 50s-60s
  Color: 1940s = noir B&W or desaturated; 1950s = saturated Kodachrome pastels; 1960s = bold pop colors
  Film aesthetic: era-matched film stock emulation, period-accurate color science
`;

/**
 * Exportable individual condition templates for targeted injection
 */
export const NIGHT_TEMPLATES = {
  urban: 'warm orange sodium street lamps creating pools of light on wet asphalt, cool blue moonlight on rooftops, neon signs providing colored rim lights, reflective wet pavement, steam from manholes, deep black shadows, anamorphic lens flares, lifted shadows 15%',
  rural: 'full moon casting blue-silver light, warm yellow porch light as primary, silhouetted tree lines, stars visible, fireflies, high ISO grain, deep blacks with blue tint, mist catching moonbeams',
  interior: 'practical lamp warm pool, TV screen cold blue on face, ambient city light through window, candle flickering micro-shadows, most of room in shadow, mixed color temperature, intimate shallow DOF',
};

export const RAIN_TEMPLATES = {
  light: 'fine misty rain visible against light sources, damp surfaces with subtle sheen, overcast flat gray sky diffusing shadows, gentle patter',
  heavy: 'thick rain streaks catching light, explosive ground splashing, deep puddles reflecting lights, rain curtain reducing visibility, soaked clothing clinging, backlit rain for visibility',
  storm: 'violent horizontal rain, lightning flashes in cold blue-white, trees bending, debris in air, howling wind, handheld camera shake, Dutch angle',
};

export const SNOW_TEMPLATES = {
  gentle: 'large soft snowflakes drifting, white ground reflecting light, frosted windows, visible breath condensation, desaturated blue-white palette, muffled ambient sounds, crisp footstep crunches',
  blizzard: 'dense horizontal snow, visibility 3-5m, whiteout, character struggling against wind, near-monochrome white-gray, zero warm tones unless artificial light',
};

export const HISTORICAL_ERA_TEMPLATES = {
  ancient: 'stone columns, marble floors, draped togas/tunics, gold jewelry, clay pots, scrolls, torches and oil lamps only, earth tones (ochre, terracotta, olive), Ridley Scott warm desaturated grade',
  medieval: 'stone castles, cobblestone, chainmail/tunics/cloaks, swords, candelabras, candlelight flickering, muted earth palette, heavy film grain, cool shadows warm fire highlights',
  renaissance: 'ornate palaces, domed frescoed ceilings, marble stairs, elaborate gowns, ruffs, velvet, Rembrandt chiaroscuro lighting, rich deep palette (red, gold, emerald)',
  victorian: 'brick factories, gas-lit foggy streets, top hats, long coats, corsets, gas lamp warm yellow, sepia palette, industrial grays, soft diffusion vignetting',
  midcentury: 'art deco, chrome diners, neon signs, fedoras, swing dresses, vintage cars, warm tungsten interior, era-matched film stock emulation',
};

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
 * Detects special conditions with granular sub-types
 */
export interface SpecialConditions {
  hasNight: boolean;
  nightType: 'urban' | 'rural' | 'interior' | null;
  hasRain: boolean;
  rainIntensity: 'light' | 'heavy' | 'storm' | null;
  hasSnow: boolean;
  snowIntensity: 'gentle' | 'blizzard' | null;
  hasFog: boolean;
  hasWind: boolean;
  windIntensity: 'gentle' | 'strong' | null;
  hasHistorical: boolean;
  historicalEra: 'ancient' | 'medieval' | 'renaissance' | 'victorian' | 'midcentury' | null;
  hasASMR: boolean;
}

export function detectSpecialConditions(scriptText: string): SpecialConditions {
  const t = scriptText.toLowerCase();
  
  const hasNight = /noite|night|escuro|dark|midnight|meia-noite|madrugada|lua|moon/i.test(t);
  const nightType = hasNight
    ? (/cidade|city|urban|rua|street|neon/i.test(t) ? 'urban'
      : /interior|quarto|room|casa|house|escritório|office/i.test(t) ? 'interior'
      : 'rural') as const
    : null;

  const hasRain = /chuva|rain|aguaceir/i.test(t);
  const rainIntensity = hasRain
    ? (/tempestade|storm|trovão|thunder|relâmpago|lightning/i.test(t) ? 'storm'
      : /forte|heavy|torrencial|downpour/i.test(t) ? 'heavy'
      : 'light') as const
    : null;

  const hasSnow = /neve|snow/i.test(t);
  const snowIntensity = hasSnow
    ? (/nevasca|blizzard|tempestade de neve/i.test(t) ? 'blizzard' : 'gentle') as const
    : null;

  const hasFog = /neblina|fog|névoa|mist|nevoeiro/i.test(t);
  const hasWind = /vento|wind/i.test(t);
  const windIntensity = hasWind
    ? (/forte|strong|violento|tempestade/i.test(t) ? 'strong' : 'gentle') as const
    : null;

  const hasHistorical = /século|century|antigo|ancient|medieval|renascen|renaissance|império|empire|1\d{3}s|19\d{2}|18\d{2}|era |época|victorian|vitorian/i.test(t);
  const historicalEra = hasHistorical
    ? (/egíp|egypt|gre[gc]|rome|roma|antigo|ancient/i.test(t) ? 'ancient'
      : /medieval|idade média|middle age|castelo|castle/i.test(t) ? 'medieval'
      : /renascen|renaissance|barroc|baroque/i.test(t) ? 'renaissance'
      : /vitorian|victorian|industrial|séc.*19|18\d{2}|19th/i.test(t) ? 'victorian'
      : /19[4-6]\d|anos 50|anos 60|1950|1960|mid.?century|art deco/i.test(t) ? 'midcentury'
      : null) as const
    : null;

  return {
    hasNight, nightType,
    hasRain, rainIntensity,
    hasSnow, snowIntensity,
    hasFog, hasWind, windIntensity,
    hasHistorical, historicalEra,
    hasASMR: /asmr|sons? detalhad|sound design|foley|immersive audio/i.test(t),
  };
}

/**
 * Build conditional training blocks — injects FULL template + targeted quick-reference
 */
export function buildConditionalTraining(scriptText: string, enableASMR?: boolean): string {
  const c = detectSpecialConditions(scriptText);
  let block = '';
  const hasAnyCondition = c.hasNight || c.hasRain || c.hasSnow || c.hasFog || c.hasWind || c.hasHistorical;
  
  if (hasAnyCondition) {
    block += SPECIAL_CONDITIONS_TEMPLATES;
    
    // Add targeted quick-inject for the AI to prioritize
    block += '\n\n═══ ACTIVE CONDITIONS FOR THIS SCRIPT ═══\n';
    if (c.hasNight && c.nightType) block += `🌙 NIGHT (${c.nightType}): ${NIGHT_TEMPLATES[c.nightType]}\n\n`;
    if (c.hasRain && c.rainIntensity) block += `🌧️ RAIN (${c.rainIntensity}): ${RAIN_TEMPLATES[c.rainIntensity]}\n\n`;
    if (c.hasSnow && c.snowIntensity) block += `❄️ SNOW (${c.snowIntensity}): ${SNOW_TEMPLATES[c.snowIntensity]}\n\n`;
    if (c.hasFog) block += `🌫️ FOG: thick volumetric fog, progressive visibility reduction, diffused light, silhouettes, god rays through mist\n\n`;
    if (c.hasWind && c.windIntensity) block += `💨 WIND (${c.windIntensity}): hair/clothing movement, environmental particles, ${c.windIntensity === 'strong' ? 'trees bending, debris flying, handheld shake' : 'soft fabric ripple, leaves tumbling, 60fps slow motion'}\n\n`;
    if (c.hasHistorical && c.historicalEra) block += `📜 ERA (${c.historicalEra}): ${HISTORICAL_ERA_TEMPLATES[c.historicalEra]}\n\n`;
  }
  
  if (c.hasASMR || enableASMR) {
    block += '\n' + ASMR_SOUND_LAYER_GUIDE;
  }
  
  return block;
}
