

# Plan: Fix Script Generation Pipeline (Roteiro → Voz → Cenas)

## Problems Identified

### 1. Broken Gateway URL in Scene Generation
**File**: `supabase/functions/transcribe-and-generate-scenes/index.ts` (line 34)
The `GATEWAY_URL` is hardcoded to the literal string `"GEMINI_COMPAT_URL"` — not a real URL. This means:
- The `callAI()` helper at line 38-87 always fails on gateway calls
- Audio transcription via gateway (line 217) always fails
- Scene generation via `callAI()` (line 602) always fails
- The system falls back to direct Gemini, which hits the same 429 quota limits

**Fix**: Replace `"GEMINI_COMPAT_URL"` with the proper Lovable AI Gateway URL (`https://ai.gateway.lovable.dev/v1/chat/completions`) and use `LOVABLE_API_KEY` for authentication instead of `GOOGLE_AI_API_KEY`.

### 2. Script Still Outputting Non-Narration Content
Despite the "100% narration" rule added previously, the prompt still contains references to `SCENE_BLUEPRINT` parsing and `---EXTRAS---` sections in the output. The `cleanAll()` function strips some of these, but the AI still wastes tokens generating them, reducing the narration word count.

**Fix**: Strengthen the cleaning logic in the frontend and ensure the prompt's EXTRAS section (titles, tags, thumbnails) is clearly separated so it doesn't bleed into narration text.

### 3. Audio Duration Shorter Than Expected (20min instead of 40min)
The `getCleanText()` function in `VoiceGeneratorStep.tsx` strips markdown headers, bold text, and formatting — but it also strips the `---EXTRAS---` section markers and everything after section headers like `## Títulos`. However, the `getCleanNarration()` in `Scripts.tsx` (line 635-641) does a more thorough job of cutting at title/tag sections. The voice generator is NOT using `getCleanNarration()` — it uses its own less thorough `getCleanText()`.

**Root cause**: The voice step receives the full `script` prop which includes EXTRAS (titles, tags, etc.), but `getCleanText()` doesn't strip those sections. More critically, the script word count itself may be short because the AI is spending tokens on non-narration content.

**Fix**: 
- Pass the clean narration text (from `getCleanNarration()`) to the voice step instead of raw script
- OR enhance `getCleanText()` in `VoiceGeneratorStep.tsx` to strip EXTRAS sections

### 4. Google API Quota Exhaustion Without Proper Fallback in TTS
The `google-tts` edge function uses `GOOGLE_AI_API_KEY` directly without the `fetchWithRetry`/fallback mechanism from `gemini-direct.ts`. When quota is exhausted, TTS fails and falls back to ElevenLabs or browser synthesis.

**Fix**: Add retry logic to the Gemini TTS call in `google-tts/index.ts`.

---

## Implementation Steps

### Step 1: Fix `transcribe-and-generate-scenes` Gateway
- Replace `GATEWAY_URL = "GEMINI_COMPAT_URL"` with `GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"`
- Change the `callAI` function to use `LOVABLE_API_KEY` for the gateway `Authorization` header instead of `GOOGLE_AI_API_KEY`
- Keep Gemini direct as fallback (already implemented)

### Step 2: Fix Voice Duration — Pass Clean Narration
- In `Scripts.tsx`, pass the cleaned narration text to `VoiceGeneratorStep` via a new prop or by enhancing the existing `script` prop
- Update `VoiceGeneratorStep.tsx` `getCleanText()` to also strip EXTRAS sections (titles, thumbnails, tags, description) using the same markers as `getCleanNarration()`

### Step 3: Add Retry to Google TTS
- In `google-tts/index.ts`, add a retry mechanism for `GEMINI_TTS_429` errors before falling back to ElevenLabs

### Step 4: Deploy and Verify
- Deploy `transcribe-and-generate-scenes`, `google-tts`, and `generate-script`
- Test the full pipeline end-to-end

