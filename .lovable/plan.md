

# V3.1 — Hollywood-Grade Script Engine

## Current Reality (Real Numbers)

| Data | Count | Status |
|---|---|---|
| Knowledge Embeddings | 70 | CRITICAL - RAG broken |
| Content DNA | 146 | WEAK |
| Hook Patterns | 210 | OK (expanded) |
| Scene Prompts | 430 | OK (expanded) |
| Prompt Library | 0 | EMPTY |
| Skill Scores | 0 | No usage yet |
| Niche Benchmarks | 0 | No usage yet |
| Content Models | 42 | Needs Hollywood models |
| Attention Engineering | 52 | Shallow |

## What's Missing: The DNA of Excellence

The system has good mechanics but lacks the **storytelling DNA** from the best content ever made. It doesn't know WHY Breaking Bad, Game of Thrones, Chernobyl, or MrBeast work. That knowledge needs to be injected into the knowledge base AND the script engine prompts.

---

## Plan (4 Parts)

### Part 1: Hollywood Storytelling DNA (seed into `script_knowledge` + `content_models`)

Inject storytelling principles extracted from elite content:

**Film/Series DNA to seed:**
- Breaking Bad: Transformation arc, Chekhov's Gun mastery, moral ambiguity escalation, "ticking clock" tension
- Game of Thrones: Multiple POVs, shocking stakes (anyone can die), political intrigue as hook, world-building through conflict
- The Sopranos: Antihero psychology, therapy as narrative device, mundane-to-violent whiplash, subtext over text
- The Wire: Systemic storytelling, no heroes/villains, procedural detail as immersion, patience rewarded
- Chernobyl: Dread through inevitability, bureaucracy as villain, scientific accuracy as horror, quiet devastation
- The Godfather: Power dynamics, family loyalty vs morality, parallel editing (baptism scene), restraint = impact
- Wolf of Wall Street: Excess as spectacle, breaking 4th wall, dopamine escalation, comedy masking tragedy
- Dark Knight: Chaos as philosophy, villain with a point, impossible choices, escalation without relief
- Titanic: Known ending = focus on HOW not WHAT, class contrast, intimate story inside epic event
- Schindler's List: Specificity creates universality, one person's choice, restraint in depicting horror, the red coat detail
- Korean Dramas/Netflix Series: Emotional precision, slow-burn payoff, visual storytelling, cultural specificity as universal hook

**YouTube Channel DNA to seed:**
- MrBeast: Promise-in-thumbnail, escalation every 30s, simple language, challenge format, impossible stakes
- MrBallen: "Strange, dark, and mysterious" formula, 3-act true story, calm delivery + horrifying content contrast
- Dhar Mann Studios: Moral lesson format, setup-twist-lesson, relatable villains, emotional resolution
- Bailey Sarian: True crime + personality, casual tone on dark topics, parasocial intimacy, research depth
- That Chapter: Irish charm + true crime, humor in darkness, audience involvement, consistent format
- Coffeehouse Crime: Documentary precision, calm authority, timeline mastery, evidence-based speculation
- Bright Side: Curiosity gap titles, list format with escalation, visual simplification, broad appeal

**Implementation:** New edge function `seed-storytelling-dna` that inserts 50+ records into `script_knowledge` and 20+ new `content_models` based on these principles.

### Part 2: Populate Prompt Library (currently 0 records)

Seed `prompt_library` with 100+ production-ready prompts organized by category:
- Hook templates by niche (true_crime, horror, western, restoration, etc.)
- Transition formulas (bridge phrases, pattern interrupts)
- Emotional escalation templates
- Cold open formulas from each Hollywood model
- CTA templates that feel organic
- Character introduction templates
- Tension-building blocks

### Part 3: Upgrade Generate-Script System Prompt

Inject the Hollywood DNA directly into the Claude system prompt in `generate-script/index.ts`:

- Add a `HOLLYWOOD_MASTERCLASS` block with the 10 key principles from elite storytelling
- Add `YOUTUBE_ELITE_DNA` block with channel-specific patterns
- Fetch from `script_knowledge` the seeded Hollywood/YouTube entries and inject them contextually (if niche=true_crime, prioritize MrBallen + Coffeehouse Crime + Chernobyl patterns)
- Add niche-to-reference mapping: true_crime → MrBallen/Bailey Sarian/Chernobyl storytelling, horror → The Wire's slow dread, superacao → Rocky/Titanic arc

Also upgrade `refine-script/index.ts`:
- Add explicit rule: "You may REWRITE the first 30s completely but the STORY must remain coherent — same characters, same plot, same emotional arc. You are changing the ENTRANCE, not the BUILDING."
- Add "Emotion Map" instruction: each 45-60s block must have a PRIMARY emotion (fear, curiosity, joy, sadness, shock) and it must DIFFER from the previous block

### Part 4: Massive Data Seeding Edge Function

Create `seed-elite-knowledge` edge function that populates:
1. `script_knowledge`: 50+ entries with Hollywood/YouTube DNA
2. `content_models`: 20+ models (Breaking Bad Arc, MrBallen Formula, Cold Open Chernobyl, etc.)
3. `prompt_library`: 100+ categorized prompts
4. `attention_engineering`: 30+ new techniques from film/series analysis

This function uses AI to generate high-quality entries based on the storytelling analysis above.

---

## Technical Details

### Files to Create
1. `supabase/functions/seed-elite-knowledge/index.ts` — seeds Hollywood/YouTube DNA into 4 tables

### Files to Modify
2. `supabase/functions/generate-script/index.ts` — add Hollywood Masterclass + YouTube Elite DNA blocks + niche-to-reference mapping
3. `supabase/functions/refine-script/index.ts` — add story coherence rules for hook rewriting + emotion map per block

### Database Changes
- No schema changes needed (all tables exist)
- Data population via edge function (INSERT into script_knowledge, content_models, prompt_library, attention_engineering)

### Execution Order
1. Create `seed-elite-knowledge` edge function
2. Upgrade `generate-script` system prompt with Hollywood DNA
3. Upgrade `refine-script` with coherence + emotion mapping rules

