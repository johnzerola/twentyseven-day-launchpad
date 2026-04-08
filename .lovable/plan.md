

# Plan: Fix Script Generation Pipeline — Quality & Duration Regressions

## Diagnosis

After comparing the current codebase with the old system behavior, I found these concrete issues:

### Problem 1: Scripts reach ~50% of target duration (40min target → 20min output)
**Root cause**: LLM output token limits. Even with `maxOutputTokens: 32000`, Gemini 2.5 Pro rarely outputs more than ~4,000-5,000 words in a single call. A 40-min script needs ~6,000 words (150 WPM × 40). The model simply stops writing when it reaches its natural generation limit.

**The old system worked** because it used shorter targets (15-25 min). At 40+ min, a single LLM call can't produce enough text.

### Problem 2: Score-script "Both AI evaluations failed" error
**Root cause**: The `callGemini` function falls back to Lovable Gateway on 403/429, but the Lovable Gateway model mapping (`mapModel`) maps many models to `gemini-2.5-pro`/`gemini-2.5-flash` which may also fail. The scoring sends the FULL script (up to 30K chars) which can exceed context/token limits on some models.

### Problem 3: Refine-script can SHRINK the script
The refiner operates as a single pass — if the LLM decides to "polish" by shortening, the output can be significantly shorter. The current guard (`refinedWords < 85% target`) falls back to the draft, but doesn't try to EXPAND.

### Problem 4: Model routing not optimized for Lovable credits
The system always tries direct Google AI API first, only falling back to Lovable Gateway on failure. The user wants to USE their Lovable credits (GPT-5 and Gemini via gateway) as PRIMARY.

---

## Implementation Steps

### Step 1: Multi-Act Script Generation for 40-60 min scripts
**File**: `supabase/functions/generate-script/index.ts`

For scripts >25 min, split generation into sequential "acts":
- Act 1: Generate hook + first ~15 min (Phase 0 hook already exists, expand to full Act 1)
- Act 2: Continue from Act 1's ending, generate next ~15 min
- Act 3+: Continue until target duration is met

Each act receives the ENDING of the previous act as context to maintain narrative continuity. Use `callGeminiStreaming` for each act and concatenate the streaming outputs.

Key changes:
- Add `multiActGeneration()` function that loops until `wordCount >= minWords`
- Each act's prompt includes: "Continue this narrative from where it left off. The story so far ends with: [last 500 words]. Write the NEXT ~{actWords} words."
- Stream each act to the client sequentially
- Cap at 4 acts max (safety limit)

### Step 2: Route through Lovable AI Gateway as PRIMARY
**File**: `supabase/functions/_shared/gemini-direct.ts`

Invert the fallback order:
- PRIMARY: Lovable AI Gateway (`ai.gateway.lovable.dev`) using `LOVABLE_API_KEY` — this uses the user's credits and supports both `google/gemini-2.5-pro` and `openai/gpt-5`
- FALLBACK: Direct Google AI API using `GOOGLE_AI_API_KEY`

Changes:
- In `callGeminiStreaming()`: Try Lovable Gateway first, fall back to direct API
- In `callGemini()`: Same — Lovable first, direct second
- In `callGeminiWithFallback()`: Same pattern
- Keep `callGeminiOpenAICompat()` routing logic (already supports both)

### Step 3: Fix scoring to use GPT-5 + Gemini (different models)
**File**: `supabase/functions/score-script/index.ts`

Currently both evaluators use `gemini-2.5-flash`. Change to:
- Evaluator A: `openai/gpt-5-mini` via Lovable Gateway (strict)  
- Evaluator B: `google/gemini-2.5-flash` via Lovable Gateway (creative)

This gives genuine "dual AI" evaluation and avoids the same model giving similar scores. Also use Lovable Gateway as primary for both.

### Step 4: Anti-shrink guard in refine-script
**File**: `supabase/functions/refine-script/index.ts`

Add explicit instruction in the prompt: "The output MUST have AT LEAST {target_words} words. If the input has more words than the target, PRESERVE the full length. NEVER summarize or cut content."

Also add a secondary expansion pass: if refined output < 90% of draft length AND draft >= target, return the draft unchanged (already exists but threshold should be 90%, not 85%).

### Step 5: Improve scoring prompt to train for 20/20
**File**: `supabase/functions/score-script/index.ts`

Enhance the `SCORE_PROMPT` to include clearer criteria for high scores (9-10) and make the scoring more actionable:
- Add examples of what a 9/10 hook looks like vs a 6/10
- Make each weakness map to a specific, actionable fix
- The "improvements" array should be surgical instructions, not vague suggestions

### Step 6: Deploy all updated edge functions
Deploy: `generate-script`, `refine-script`, `score-script`, and the shared `gemini-direct.ts`

---

## Files Changed Summary

| File | Change |
|------|--------|
| `supabase/functions/_shared/gemini-direct.ts` | Invert fallback: Lovable Gateway PRIMARY, direct API FALLBACK |
| `supabase/functions/generate-script/index.ts` | Multi-act generation for 40-60 min scripts |
| `supabase/functions/refine-script/index.ts` | Anti-shrink guard at 90%, stronger prompt |
| `supabase/functions/score-script/index.ts` | Use GPT-5-mini + Gemini via Lovable Gateway, improved scoring criteria |

