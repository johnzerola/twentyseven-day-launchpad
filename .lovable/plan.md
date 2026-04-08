

# Plan: Upgrade AI Models in score-script and generate-ideas

## Bug 1 — score-script uses weak GPT model

**Current**: Evaluator A uses `openai/gpt-5-mini` (line 223 of `score-script/index.ts`)
**Fix**: Change to `openai/gpt-5` — the strongest GPT-5 model available on Lovable AI Gateway. (Note: `gpt-4o` and `gpt-4.5` are not available on the Lovable Gateway. The available options are `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, and `gpt-5.2`. Best choice for rigorous evaluation: `openai/gpt-5`)

**File**: `supabase/functions/score-script/index.ts`
- Line 223: `model: 'openai/gpt-5-mini'` → `model: 'openai/gpt-5'`
- Update log messages and variable names accordingly

## Bug 2 — generate-ideas uses flash instead of pro

**Current**: Line 165 uses `google/gemini-2.5-flash`
**Fix**: Change to `google/gemini-2.5-pro` for superior strategic reasoning and creativity.

**File**: `supabase/functions/generate-ideas/index.ts`
- Line 165: `model: "google/gemini-2.5-flash"` → `model: "google/gemini-2.5-pro"`

## Deployment

Redeploy both `score-script` and `generate-ideas` edge functions.

## Cost Impact

Both `gpt-5` and `gemini-2.5-pro` are more expensive and slower than their lighter counterparts. This is justified for these two critical functions (evaluation quality and idea generation quality are core to the product).

