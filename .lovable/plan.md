

# Plan: Fix Channels + Improve Scripts Pipeline + Scene Export

## Issues Identified

### 1. Channels Page — Data Not Refreshing After Analysis
**Root Cause**: `refreshChannel()` (line 154-174) calls `loadChannels()` to reload from DB, but `selectedChannel` state is never updated with the new data. The tabs check `analysis?.topVideos` from the stale `selectedChannel` object.

**Fix**: After `loadChannels()` completes, re-select the channel from the refreshed list so `selectedChannel` gets the updated `analysis_json`.

### 2. Scripts — Auto-suggest Themes When Topic Changes
Currently the theme suggestions panel requires clicking a button. Add a debounced auto-trigger when the user types a topic + has a niche set.

### 3. Scripts — Duration Not Strictly Enforced
The `generate-script` edge function instructs the AI to write "MINIMUM X words" but has no hard enforcement. Add a validation check post-generation and display a warning if the script is significantly short.

### 4. Scripts — Scene Export for AutoFlow in JSON Format
Currently exports as plain text lines. The user wants proper JSON with scene numbering, quality specs, and timing per the audio transcription (5-10s per scene based on audio).

### 5. Database Completeness — Missing Styles in Knowledge
The `scene_prompt_knowledge` has good coverage but is missing templates for: `wojak`, `stickmen`, `whiteboard`, `comic` video styles. The `script_knowledge` has 26 templates but may lack some script styles from the STYLES array.

---

## Implementation Plan

### A. Fix Channels Page (Critical Bug)
**File**: `src/pages/Channels.tsx`
- In `refreshChannel()`: after `loadChannels()`, find the updated channel in the new list and call `selectChannel()` on it
- In `loadChannels()`: if `selectedChannel` exists, update it from the fresh data
- This fixes Overview, Competitors, and Suggestions tabs all showing stale/no data

### B. Auto-Suggest Themes on Topic Input
**File**: `src/pages/Scripts.tsx`
- Add a `useEffect` with debounce (1.5s) that triggers `generateThemeSuggestions()` when `topic` has 5+ chars and `niche` is set
- Auto-open the theme suggestions panel when results arrive
- Keep manual button as fallback

### C. Enforce Duration in Script Generation
**File**: `supabase/functions/generate-script/index.ts`
- Strengthen the system prompt with explicit word count requirements per duration
- Add a post-generation word count check — if script is <70% of target, add a warning in the response

### D. AutoFlow JSON Export
**File**: `src/pages/Scripts.tsx`
- Add a new "JSON AutoFlow" export button that generates structured JSON:
```json
{
  "scenes": [
    {
      "scene": "Cena 1",
      "prompt": "...",
      "quality": "8K UHD, cinematic",
      "duration": "8s",
      "startTime": 0,
      "endTime": 8,
      "camera": "dolly shot",
      "mood": "mysterious"
    }
  ]
}
```
- Include timing from audio transcription when available

### E. Expand Database Knowledge
**Migration**: Insert ~20 new templates for missing video styles:
- `wojak`: 4 templates (expressions, reactions, transitions, environments)
- `stickmen`: 4 templates (action, comedy, educational, transitions)  
- `whiteboard`: 4 templates (reveal drawings, diagrams, equations, timelines)
- `comic`: 4 templates (action panels, speech bubbles as visuals, dynamic poses, splash pages)
- Additional `script_knowledge` templates for `conspiração`, `mitologia`, `teorias` styles

### F. Improve Audio-to-Scenes Timing
**File**: `supabase/functions/audio-to-scenes/index.ts`
- Enforce scene duration between 5-10 seconds strictly based on audio transcript block timing
- Ensure output JSON matches the AutoFlow format with scene numbering

---

## Files to Edit
| File | Changes |
|------|---------|
| `src/pages/Channels.tsx` | Fix selectedChannel refresh after analysis |
| `src/pages/Scripts.tsx` | Auto-suggest themes, JSON AutoFlow export |
| `supabase/functions/generate-script/index.ts` | Stronger duration enforcement |
| `supabase/functions/audio-to-scenes/index.ts` | 5-10s scene duration enforcement |
| Database migration | +20 scene_prompt_knowledge templates |

## Estimated Scope
- 6 files modified
- 1 database migration
- Fixes the critical Channels bug and improves the entire Scripts pipeline

