

# Verificação Completa do Sistema — Bugs e Problemas Encontrados

## Bugs Encontrados

### BUG 1: Voice step throws error after browser fallback (CRITICAL)
In `AutoPilotEngine.tsx`, when TTS falls back to browser synthesis (line 319-326), it sets the step as "done" and breaks the loop. But then the code continues to line 330-337 where it checks `if (blobs.length > 0)` — since browser fallback produces no blobs, it falls through to `throw new Error('No audio generated')`, which overwrites the "done" status with an error.

**Fix:** After the `break` in browser fallback, add a flag to skip the blob check. Or restructure so the `else` block at line 336 checks if the step was already marked done.

### BUG 2: AnimatePresence mode="wait" with multiple children (Console Warning)
In `Scripts.tsx` lines 1040-1372, `<AnimatePresence mode="wait">` wraps multiple conditional renders that can be true simultaneously (e.g., `activeStep === 'titles'` renders TitleSEOStep, ThumbnailGenerator, PackagingLab, and ProductionPack all at once — lines 1299, 1316, 1324, 1338). This causes the console warning "attempting to animate multiple children within AnimatePresence, but its mode is set to wait."

**Fix:** Remove `mode="wait"` or restructure so only one child renders per step.

### BUG 3: Badge ref warning in ScriptPerformanceTracker
Console shows "Function components cannot be given refs" for Badge inside ScriptPerformanceTracker. This is a framer-motion `AnimatePresence` trying to pass a ref to Badge.

**Fix:** Wrap Badge with `forwardRef` or use a `<div>` wrapper.

### BUG 4: Wizard auto-triggers AutoPilot via DOM click (fragile)
In `Scripts.tsx` line 751-754, after wizard configuration, a `setTimeout` + `document.getElementById('autopilot-launch-btn').click()` is used to trigger the pipeline. This is fragile — if the button isn't rendered yet (race condition), it fails silently.

**Fix:** Replace with a direct function call via a ref or callback instead of DOM manipulation.

### BUG 5: Voice step not passed to `generate-script` edge function
In `AutoPilotEngine.tsx` line 249-256, the `generateScriptSSE` call passes `style` but not `voiceStyle`. The voice style chosen by the user in the wizard is not influencing the script generation — only the TTS step uses it.

**Fix:** Pass `voiceStyle` to the script generation body so the AI adapts writing style to match voice.

### BUG 6: Missing `niche` validation in "Gerar Tudo Automaticamente"
The "Gerar Tudo Automaticamente" button (line 445) requires `niche.trim()` to be non-empty, but the VideoCreationWizard always sets a niche. However, if wizard is bypassed via URL params or history restore, `niche` could be empty and the button stays disabled without explanation.

**Fix:** Show a tooltip or message when disabled explaining why.

### BUG 7: `voiceStyleProp` not in dependency array of `runPipeline`
In `AutoPilotEngine.tsx` line 417, `voiceStyleProp` is used inside `runPipeline` (line 305) but is NOT listed in the `useCallback` dependency array. This means stale closures could use the wrong voice style.

**Fix:** Add `voiceStyleProp` to the dependency array.

## Implementation Plan

### Step 1: Fix browser fallback voice bug (AutoPilotEngine.tsx)
- Add a `browserFallbackUsed` flag before the loop
- After the loop, check the flag before throwing "No audio generated"
- If flag is true, skip the blob check entirely

### Step 2: Fix AnimatePresence multiple children (Scripts.tsx)
- Change `<AnimatePresence mode="wait">` to `<AnimatePresence>` (no mode)
- This allows multiple children to animate simultaneously without warnings

### Step 3: Fix Badge ref warning (ScriptPerformanceTracker.tsx)
- Wrap animated Badge with a `<span>` or `<div>` instead of passing ref directly

### Step 4: Replace DOM click with direct function call (Scripts.tsx)
- Store `runPipeline` from AutoPilotEngine via a ref/callback
- Call it directly from the wizard's `onLaunch` instead of using `getElementById`

### Step 5: Add voiceStyleProp to dependency array (AutoPilotEngine.tsx)
- Add `voiceStyleProp` to `runPipeline`'s `useCallback` deps

### Step 6: Pass voiceStyle to script generation (AutoPilotEngine.tsx)
- Add `voiceStyle: voiceStyleProp` to the `generateScriptSSE` body

### Technical Details

Files to modify:
- `src/components/scripts/AutoPilotEngine.tsx` — Bugs 1, 5, 6, 7
- `src/pages/Scripts.tsx` — Bugs 2, 4
- `src/components/dashboard/ScriptPerformanceTracker.tsx` — Bug 3

All other pages (Dashboard, Channels, Titles, ViralDatabase, Landing, Login, etc.) are structurally sound. The edge functions are operational (confirmed in previous tests). The main issues are concentrated in the Scripts pipeline flow.

