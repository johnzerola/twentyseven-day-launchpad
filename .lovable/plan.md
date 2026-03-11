

# Fix: audio-to-scenes generating too few scenes

## Problem
674s audio (11+ minutes) should produce ~84 scenes at 8s each, but only 8 were generated. The AI receives the full transcript but "gets lazy" and only covers a small portion — a known LLM behavior with large inputs.

## Root Cause
Single AI call with massive transcript → LLM generates a few high-quality scenes and stops, ignoring the rest of the audio. The output token budget gets exhausted or the model summarizes instead of being exhaustive.

## Solution: Chunked Processing

Split the transcript into time-based chunks (~90s each), send each chunk as a separate AI call, then merge all scenes with corrected indices.

### Changes to `supabase/functions/audio-to-scenes/index.ts`:

1. **Chunk the transcript blocks** into groups of ~90 seconds based on timestamps
2. **Process each chunk** with a separate AI call (in sequence to avoid rate limits), telling the AI "this is chunk N of M, covering X-Y seconds"
3. **Merge all scene arrays** with sequential `sceneIndex` values
4. **Reduce per-chunk prompt size** — each chunk only gets its own transcript portion (~3-5k chars), so the AI can focus on generating all scenes for that segment
5. **Add explicit instruction**: "You MUST generate one scene for every ~8 seconds. Do NOT skip any portion."

### Expected result for 674s audio:
- ~7-8 chunks of ~90s each
- Each chunk produces ~11 scenes
- Total: ~77-84 scenes covering the entire audio

### Technical flow:
```text
674s audio transcribed → 200+ blocks
  ↓
Split into chunks: [0-90s] [90-180s] [180-270s] ... [630-674s]
  ↓
For each chunk → AI call (lightweight, ~3k transcript)
  → generates 10-12 scenes per chunk
  ↓
Merge all scenes → 70-84 total scenes
  ↓
Return complete coverage
```

### Additional improvements:
- Log chunk count and per-chunk scene count for debugging
- If a chunk fails, continue with remaining chunks (partial results better than none)
- Keep system prompt compact per chunk (no need to repeat full knowledge base every time — include it only in first chunk)

