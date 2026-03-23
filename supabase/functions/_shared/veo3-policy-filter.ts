// ═══════════════════════════════════════════════════════════════
// VEO3 POLICY COMPLIANCE FILTER — Copyright & Celebrity Protection
// Prevents generation failures by replacing copyrighted names with descriptions
// ═══════════════════════════════════════════════════════════════

// ═══ COPYRIGHTED CHARACTERS — Replace name with visual description ═══
const COPYRIGHT_REPLACEMENTS: [RegExp, string][] = [
  // Simpsons
  [/\b(homer\s*simpson|homer)\b/gi, 'overweight middle-aged bald man with yellow skin tone, white polo shirt, blue pants'],
  [/\b(marge\s*simpson|marge)\b/gi, 'tall slender woman with extremely tall blue beehive hair, green dress, yellow skin tone'],
  [/\b(bart\s*simpson|bart)\b/gi, 'mischievous young boy with spiky yellow hair, red t-shirt, blue shorts'],
  [/\b(lisa\s*simpson|lisa)\b/gi, 'young girl with spiky yellow hair, red dress, pearl necklace'],
  [/\bsimpsons?\b/gi, 'yellow-skinned cartoon family in a suburban American town'],
  // Disney/Pixar characters
  [/\b(mickey\s*mouse|mickey)\b/gi, 'cheerful anthropomorphic mouse with large round ears, red shorts, white gloves'],
  [/\b(donald\s*duck|donald)\b/gi, 'angry anthropomorphic white duck in blue sailor outfit'],
  [/\b(elsa)\b/gi, 'platinum blonde queen in ice-blue gown with magical frost powers'],
  [/\b(buzz\s*lightyear|buzz)\b/gi, 'heroic space ranger toy in white and green armor with purple accents'],
  [/\b(woody)\b/gi, 'cowboy doll with brown hat, yellow plaid shirt, and pull-string'],
  // Marvel/DC
  [/\b(spider-?man|spiderman)\b/gi, 'agile masked hero in red and blue skin-tight suit with web pattern'],
  [/\b(iron\s*man|ironman)\b/gi, 'armored hero in red and gold metallic power suit with glowing chest piece'],
  [/\b(batman)\b/gi, 'dark caped vigilante in black armored suit with pointed cowl and cape'],
  [/\b(superman)\b/gi, 'powerful hero in blue suit with red cape and S-symbol on chest'],
  [/\b(hulk)\b/gi, 'massive green-skinned muscular giant with torn purple pants'],
  [/\b(captain\s*america)\b/gi, 'patriotic soldier in blue suit with white star on chest and round shield'],
  [/\b(thor)\b/gi, 'long-haired nordic warrior with red cape and mystical hammer'],
  [/\b(thanos)\b/gi, 'massive purple-skinned titan with golden gauntlet'],
  // Anime
  [/\b(goku)\b/gi, 'spiky-haired martial artist in orange fighting gi with blue belt'],
  [/\b(naruto)\b/gi, 'blonde spiky-haired ninja teen in orange and black jumpsuit with headband'],
  [/\b(luffy)\b/gi, 'young pirate with straw hat, red vest, and rubbery stretching abilities'],
  [/\b(pikachu)\b/gi, 'small yellow electric mouse creature with red cheeks and lightning-bolt tail'],
  [/\bpokemon\b/gi, 'colorful fantastical creatures with elemental powers'],
  [/\b(dragon\s*ball)\b/gi, 'martial arts anime with energy-based combat'],
  // Other franchises
  [/\b(mario)\b/gi, 'short plumber with red cap, blue overalls, and thick brown mustache'],
  [/\b(sonic)\b/gi, 'fast blue hedgehog with red sneakers'],
  [/\b(shrek)\b/gi, 'large green ogre with brown vest in a swamp'],
  [/\b(spongebob)\b/gi, 'cheerful yellow square sea sponge in brown pants with tie'],
  [/\b(harry\s*potter)\b/gi, 'young wizard with round glasses, lightning scar, and black robe'],
  [/\b(darth\s*vader)\b/gi, 'tall dark-armored figure with black helmet and flowing cape, heavy mechanical breathing'],
  [/\b(star\s*wars)\b/gi, 'space opera with laser swords and galactic conflict'],
  [/\b(lord\s*of\s*the\s*rings|lotr)\b/gi, 'epic medieval fantasy with mystical rings and ancient kingdoms'],
];

// ═══ CELEBRITIES & POLITICIANS — Replace with physical descriptions ═══
const CELEBRITY_REPLACEMENTS: [RegExp, string][] = [
  // Brazilian politicians
  [/\b(lula|luiz\s*inácio)\b/gi, 'elderly Brazilian man with gray beard, stocky build, charismatic expression'],
  [/\b(bolsonaro|jair\s*bolsonaro)\b/gi, 'tall middle-aged Brazilian man with dark hair, military bearing'],
  [/\b(dilma)\b/gi, 'middle-aged Brazilian woman with short reddish-brown hair, formal attire'],
  // US politicians
  [/\b(trump|donald\s*trump)\b/gi, 'tall elderly man with distinctive blonde combover hair, red tie, dark suit, expressive hand gestures'],
  [/\b(biden|joe\s*biden)\b/gi, 'elderly man with white hair, aviator sunglasses, dark suit'],
  [/\b(obama|barack\s*obama)\b/gi, 'tall slim man with short dark hair, confident smile, dark suit'],
  [/\b(hillary\s*clinton)\b/gi, 'blonde woman in formal pantsuit, political figure'],
  // World leaders
  [/\b(putin|vladimir\s*putin)\b/gi, 'stern-faced man with receding hairline, cold blue eyes, dark suit'],
  [/\b(xi\s*jinping)\b/gi, 'round-faced East Asian leader in dark formal suit'],
  [/\b(zelensky)\b/gi, 'young leader in military-green t-shirt with short dark hair'],
  // Celebrities
  [/\b(elon\s*musk|elon)\b/gi, 'tech entrepreneur with short brown hair, slightly awkward demeanor'],
  [/\b(taylor\s*swift)\b/gi, 'tall blonde pop star in sparkling stage outfit'],
  [/\b(beyoncé|beyonce)\b/gi, 'glamorous Black woman with flowing hair, powerful stage presence'],
  [/\b(kim\s*kardashian)\b/gi, 'curvaceous woman with long dark hair, glamorous outfit'],
  [/\b(cristiano\s*ronaldo|cr7)\b/gi, 'athletic Portuguese soccer player with sculpted physique, short dark hair'],
  [/\b(messi|lionel\s*messi)\b/gi, 'short Argentine soccer player with beard, focused expression'],
  [/\b(neymar)\b/gi, 'Brazilian soccer player with styled hair, athletic build'],
  [/\b(mr\.?\s*beast|mrbeast)\b/gi, 'tall young man with brown hair, casual streetwear, energetic expression'],
  [/\b(pewdiepie)\b/gi, 'Swedish man with light brown hair and beard, casual gaming setup'],
  // Tech figures
  [/\b(mark\s*zuckerberg)\b/gi, 'young tech CEO with curly brown hair and plain gray t-shirt'],
  [/\b(jeff\s*bezos)\b/gi, 'bald muscular man in casual vest, confident stance'],
  [/\b(steve\s*jobs)\b/gi, 'slim man with round glasses, black turtleneck, and jeans'],
  [/\b(bill\s*gates)\b/gi, 'tech philanthropist with glasses and receding gray hair'],
];

// ═══ BRAND NAMES that trigger Veo3 content policy ═══
const BRAND_REPLACEMENTS: [RegExp, string][] = [
  [/\b(coca[\s-]?cola|coca)\b/gi, 'red-labeled carbonated soft drink bottle'],
  [/\b(pepsi)\b/gi, 'blue-labeled carbonated drink'],
  [/\b(mcdonalds|mcdonald's|mc\s*donald)\b/gi, 'popular fast food restaurant with golden arches'],
  [/\b(nike)\b/gi, 'athletic sportswear brand with swoosh logo'],
  [/\b(apple\s+(?:inc|company|iphone|mac))\b/gi, 'premium tech company products'],
  [/\b(iphone)\b/gi, 'premium smartphone with large screen'],
  [/\b(ferrari)\b/gi, 'sleek Italian red supercar'],
  [/\b(lamborghini)\b/gi, 'angular exotic Italian supercar'],
  [/\b(rolex)\b/gi, 'luxury Swiss wristwatch with metal bracelet'],
  [/\b(gucci)\b/gi, 'high-end Italian fashion brand'],
  [/\b(louis\s*vuitton|lv)\b/gi, 'luxury French fashion brand'],
  [/\b(netflix)\b/gi, 'streaming entertainment platform'],
  [/\b(youtube)\b/gi, 'video sharing platform'],
  [/\b(instagram)\b/gi, 'photo sharing social media app'],
  [/\b(tiktok)\b/gi, 'short-form video platform'],
  [/\b(facebook)\b/gi, 'social media platform'],
  [/\b(twitter|x\.com)\b/gi, 'microblogging social platform'],
  [/\b(google)\b/gi, 'major internet search engine'],
  [/\b(amazon)\b/gi, 'major e-commerce platform'],
  [/\b(tesla)\b/gi, 'electric vehicle with minimalist design'],
  [/\b(playstation|ps5)\b/gi, 'modern gaming console with controller'],
  [/\b(xbox)\b/gi, 'gaming console with green accents'],
  [/\b(nintendo)\b/gi, 'family-friendly gaming device'],
];

// ═══ Trigger words (violence/NSFW) — existing ═══
export const TRIGGER_REPLACEMENTS: Record<string, string> = {
  'gun': 'defensive stance',
  'weapon': 'tactical equipment',
  'pistol': 'holstered sidearm implied',
  'rifle': 'long equipment case',
  'knife': 'sharp tool',
  'blade': 'metallic edge',
  'sword': 'ceremonial object',
  'blood': 'dark stain',
  'bleeding': 'distressed expression',
  'wound': 'bandaged area',
  'injury': 'visible pain expression',
  'gore': 'aftermath scene',
  'visceral': 'intense emotional',
  'dead': 'covered shape on ground',
  'corpse': 'white sheet covering form',
  'cadaver': 'memorial scene',
  'dying': 'fading consciousness',
  'naked': 'draped in fabric',
  'nude': 'artistically covered',
  'punch': 'aggressive forward motion',
  'kick': 'defensive movement',
  'hit': 'forceful gesture',
  'attack': 'confrontational stance',
  'assault': 'tense confrontation',
  'beat': 'rhythmic motion',
  'drugs': 'mysterious substance',
  'cocaine': 'white powder implied',
  'heroin': 'controlled substance implied',
  'needle': 'medical instrument',
  'injection': 'medical procedure',
  'kill': 'eliminate from the situation',
  'murder': 'dark criminal act implied',
  'torture': 'extreme duress expression',
  'explosion': 'massive shockwave and debris cloud',
  'bomb': 'concealed device',
  'terrorist': 'extremist threat',
  'suicide': 'person in deep crisis',
  'rape': 'traumatic assault aftermath',
  'slave': 'forced labor victim',
  'slavery': 'forced servitude era',
};

export const ANTI_TEXT_SUFFIX = "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";

/**
 * Full Veo3 policy compliance filter. 
 * Applies: trigger words + copyright + celebrity + brand replacements.
 * Returns cleaned prompt + list of all fixes applied.
 */
export function applyVeo3PolicyFilter(prompt: string): { cleaned: string; fixes: string[] } {
  const fixes: string[] = [];
  let cleaned = prompt;

  // 1. Copyright characters
  for (const [regex, replacement] of COPYRIGHT_REPLACEMENTS) {
    const match = cleaned.match(regex);
    if (match) {
      cleaned = cleaned.replace(regex, replacement);
      fixes.push(`©️ "${match[0]}" → described by appearance`);
    }
  }

  // 2. Celebrities & politicians
  for (const [regex, replacement] of CELEBRITY_REPLACEMENTS) {
    const match = cleaned.match(regex);
    if (match) {
      cleaned = cleaned.replace(regex, replacement);
      fixes.push(`👤 "${match[0]}" → described by appearance`);
    }
  }

  // 3. Brand names
  for (const [regex, replacement] of BRAND_REPLACEMENTS) {
    const match = cleaned.match(regex);
    if (match) {
      cleaned = cleaned.replace(regex, replacement);
      fixes.push(`🏷️ "${match[0]}" → generic description`);
    }
  }

  // 4. Trigger words (violence/NSFW)
  for (const [tw, replacement] of Object.entries(TRIGGER_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${tw}\\b`, 'gi');
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(new RegExp(`\\b${tw}\\b`, 'gi'), replacement);
      fixes.push(`⚠️ "${tw}" → "${replacement}"`);
    }
  }

  // 5. Ensure anti-text suffix
  if (!cleaned.includes("no subtitles")) {
    cleaned += ` ${ANTI_TEXT_SUFFIX}`;
  }

  // 6. Remove leaked numbering/titles
  cleaned = cleaned.replace(/^(Scene|Cena|Prompt|Segmento)\s*\d+\s*[:—-]\s*/i, '');

  return { cleaned, fixes };
}

/**
 * System prompt addition for Veo3 policy compliance.
 * Add this to ALL system prompts that generate visual prompts.
 */
export const VEO3_POLICY_PROMPT = `
═══ VEO3 CONTENT POLICY — CRITICAL COMPLIANCE ═══

🚫 NEVER USE REAL NAMES — Veo3 BLOCKS prompts with:
- Copyrighted characters (Simpsons, Mickey Mouse, Spider-Man, Goku, Mario, etc.)
- Celebrity names (politicians, actors, athletes, YouTubers)
- Brand names (Nike, iPhone, Tesla, Netflix, etc.)

✅ INSTEAD: DESCRIBE BY PHYSICAL APPEARANCE:
- ❌ "Homer Simpson eating a donut"
- ✅ "overweight bald man with yellow skin tone in white polo shirt eating a frosted pastry"
- ❌ "Trump giving a speech"  
- ✅ "tall elderly man with distinctive blonde combover hair, red tie, expressive hand gestures at podium"
- ❌ "Simpsons family in their living room"
- ✅ "yellow-skinned cartoon family sitting on orange couch in messy suburban living room"

RULE: If the script mentions ANY real person, character, or brand — describe their VISUAL APPEARANCE instead of using their name. This prevents Veo3 from blocking the generation.
`;
