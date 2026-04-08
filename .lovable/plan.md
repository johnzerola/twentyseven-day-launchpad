

# Plan: Fix 5 Critical Bugs in Script Pipeline

## Current State Assessment

After inspecting the code, here's what I found:

- **BUG 1 (score-script model)**: The code at line 223 already says `openai/gpt-5` — it was fixed in a previous session. However, `openai/gpt-4o` is **not available** on the Lovable AI Gateway. The available models are: `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5.2`. **`openai/gpt-5` is already the strongest available option** — no change needed here.

- **BUG 2 (generate-ideas model)**: Line 165 already says `google/gemini-2.5-pro` — also already fixed. No change needed.

- **BUG 3 (deprecated auth)**: CONFIRMED — line 29 uses `getClaims()` which doesn't exist in Supabase JS v2. This causes auth failures silently. **Must fix.**

- **BUG 4 (silent RAG failure)**: CONFIRMED — line 287 catches the error with just `console.warn` and no flag is propagated. Since the response is SSE-streamed, I'll inject a custom header `X-Rag-Status: failed` and also prefix the stream with a metadata SSE event so the frontend can show a toast.

- **BUG 5 (rejection learning contamination)**: CONFIRMED — line 349-353 fetches all `dual_score_rejection` learnings with no score filter. Must add a quality gate.

## Changes

### File 1: `supabase/functions/generate-ideas/index.ts`
- **Lines 27-34**: Replace `getClaims()` auth with standard `getUser()` pattern:
```ts
const { data: userData, error: userError } = await _authSb.auth.getUser();
if (userError || !userData?.user) {
  return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### File 2: `supabase/functions/generate-script/index.ts`
- **Lines 266-287 (RAG block)**: Add a `let ragFailed = false;` variable before the try block. Set `ragFailed = true` in the catch. Also set it if `skrRes` is not ok.
- **Line 1123 (streaming response)**: Add `X-Rag-Status` header to the response: `"X-Rag-Status": ragFailed ? "failed" : "ok"`
- **Lines 349-353 (rejection learnings query)**: Add filter to only fetch learnings where the combined score was truly bad. Since `ai_learning.insight` is a JSON string containing scores, parse and filter client-side: skip any rejection where `combined_score > 10` during the aggregation loop (lines 360-372).

### File 3: `src/components/scripts/ScriptGenerator.tsx`
- **Lines 362-378 (after streaming)**: After the `streamFromFunction` call, check the response headers for `X-Rag-Status: failed` and show a toast warning: "⚠️ Base de conhecimento indisponível — roteiro gerado sem dados contextuais". This requires modifying `streamFromFunction` to also return headers, or using the existing pattern to detect it.

Actually, since `streamFromFunction` likely uses `supabase.functions.invoke` or a direct fetch, I need to check how it works to pass headers back. Let me note: I'll add the RAG warning as a **first SSE data line** (e.g., `data: {"_meta":{"rag_failed":true}}`) that the frontend parser can detect and show a toast, which is simpler than modifying the streaming utility.

### Deployment
Redeploy: `generate-ideas`, `generate-script`

## Summary

| Bug | Status | Action |
|-----|--------|--------|
| BUG 1 (scoring model) | Already `gpt-5` | No change needed |
| BUG 2 (ideas model) | Already `gemini-2.5-pro` | No change needed |
| BUG 3 (deprecated auth) | Real bug | Fix `getClaims` → `getUser` |
| BUG 4 (silent RAG failure) | Real bug | Add `ragFailed` flag + SSE meta event + frontend toast |
| BUG 5 (rejection contamination) | Real bug | Filter rejections with `combined_score > 10` |

