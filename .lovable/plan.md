

# Plan: Full Pipeline Restoration — Script → Audio → Scenes → Titles/Thumbnails

## Root Cause Analysis

After comparing the old working version with the current code, I identified these concrete regressions:

### 1. TTS Engine Failure (Audio Not Generating)
- **Google Cloud TTS**: Returns 403 (billing not enabled on the Google project)
- **Gemini TTS**: Returns 429 (quota exhausted — shares quota with script generation)
- **ElevenLabs**: Returns 401 (free tier blocked)
- **Result**: All three engines fail → returns `use_browser_synthesis: true` → no audio blob → scenes can't sync

### 2. Script Score Truncated at 12,000 chars
- `score-script/index.ts` line 155: `const scriptText = script.slice(0, 12000);`
- A 40-minute script at 150 WPM = ~6,000 words = ~36,000 chars
- Only 33% of the script is evaluated — the ending, CTA, and climax are NEVER scored

### 3. Score Prompt Still Asks for VFX/SFX Tags
- `score-script` SCORE_PROMPT (lines 76-84) penalizes scripts for NOT having `[ÁUDIO:]`, `[SFX:]`, `[J-CUT]`, `[BLENDER:]` tags
- But `generate-script` now correctly forbids these tags
- **Result**: Scripts are penalized for following the rules

### 4. Project Save Truncates Script
- `getOrCreateProject()` line 551: `script: script.slice(0, 500)`
- Only 500 characters of a 36,000-char script are saved
- Reopening a project loses the entire script

### 5. ThumbnailGenerator Uses Raw Topic, Not Final Title
- Line 1267: `<ThumbnailGenerator videoTitle={topic} niche={niche} />`
- Uses `topic` (e.g., "O que acontece se...") instead of the selected winning title
- TitleSEOStep doesn't expose `selectedWinningTitle` to parent

### 6. WAV Concatenation Issues for Long Audio
- `VoiceGeneratorStep` chunks at 800 chars — a 40-min script (~36,000 chars) = 45 chunks
- WAV concatenation of 45 chunks can fail or produce glitchy audio
- No MP3 concatenation support — Google Cloud TTS returns MP3, not WAV

---

## Implementation Steps

### Step 1: Fix TTS with Lovable AI Gateway Fallback
**File**: `supabase/functions/google-tts/index.ts`

The Lovable AI Gateway supports Gemini TTS models and has its own quota. Add it as a fallback between Gemini direct and ElevenLabs:
- After Google Cloud TTS fails (403 billing) and before Gemini direct (429 quota), try calling Gemini TTS through the Lovable AI Gateway using `LOVABLE_API_KEY`
- The gateway URL is `https://ai.gateway.lovable.dev/v1/chat/completions` — but TTS needs direct `generativelanguage.googleapis.com`. Instead, use `callGeminiOpenAICompat` from `gemini-direct.ts` to route text-to-speech as a chat completion with audio response modality

Since the Lovable Gateway doesn't directly support TTS audio modality, the actual fix is:
- Keep Google Cloud TTS as primary (will work once billing is enabled)
- Keep Gemini TTS with retry as secondary
- Keep ElevenLabs as tertiary
- **Increase chunk size** from 800 to 2000 chars to reduce API calls (fewer 429 hits)
- Add proper **MP3 binary concatenation** support (Google Cloud TTS returns MP3)

### Step 2: Fix Score-Script — Remove 12K Truncation + VFX Penalty
**File**: `supabase/functions/score-script/index.ts`

- Remove `script.slice(0, 12000)` — pass the full script (or if too large for context, split into beginning/middle/end blocks and score each)
- Remove the VFX/SFX/sound design tag penalty from `SCORE_PROMPT` (lines 76-84, 117-118) since the script generator now correctly produces pure narration
- Remove `has_binge_loop` and `uses_but_therefore` from the JSON schema (or keep them but don't penalize for missing tags)

### Step 3: Fix Project Save — Store Full Script
**File**: `src/pages/Scripts.tsx`

- Change `script: script.slice(0, 500)` to `script: script` in `getOrCreateProject()`
- Also store `duration`, `niche`, `videoStyle`, `language` in the project

### Step 4: Fix ThumbnailGenerator — Use Winning Title
**Files**: `src/components/scripts/TitleSEOStep.tsx`, `src/pages/Scripts.tsx`

- Add `onTitleSelected` callback prop to `TitleSEOStep`
- Track `selectedTitle` state in `Scripts.tsx`
- Pass `selectedTitle || topic` to `ThumbnailGenerator`

### Step 5: Fix Audio Chunk Size + MP3 Concatenation
**File**: `src/components/scripts/VoiceGeneratorStep.tsx`

- Increase `MAX_CHUNK_CHARS` from 800 to 2000 (reduces API calls from 45 to ~18 for a 40-min script)
- Add MP3 binary concatenation path (for Google Cloud TTS which returns MP3)
- The existing WAV concatenation is correct for Gemini TTS

### Step 6: Deploy and Verify Edge Functions
- Deploy `google-tts`, `score-script`, `generate-script`
- Test with curl to verify each function works

---

## Files Changed Summary

| File | Change |
|------|--------|
| `supabase/functions/score-script/index.ts` | Remove 12K truncation, remove VFX/SFX penalty |
| `supabase/functions/google-tts/index.ts` | Increase chunk tolerance, improve error handling |
| `src/pages/Scripts.tsx` | Fix project save (full script), add selectedTitle state, pass to ThumbnailGenerator |
| `src/components/scripts/TitleSEOStep.tsx` | Add onTitleSelected callback |
| `src/components/scripts/VoiceGeneratorStep.tsx` | Increase MAX_CHUNK_CHARS to 2000, add MP3 concatenation |

