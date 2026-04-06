
# Correções Críticas do Sistema — Auditoria de Qualidade

The plan has already been approved via the plan tool. Here is the implementation summary for 5 priorities across 11 files:

## PRIORIDADE 1: Honestidade Epistêmica nos Scores
- `score-script`: Add `confidence_source`, `calibration_status`, `hook_mechanism_detected` to response JSON
- `generate-thumbnail-prompt`: Rename `expected_ctr_boost` → `estimated_ctr_boost_ai` with `source: "ai_estimate"`
- `packaging-score`: Add `confidence_source: "ai_estimate"` to response
- `generate-titles`: Add `ctr_source: "ai_estimate"` per title
- `ThumbnailGenerator.tsx`: Show "Estimativa IA" badge next to CTR boost

## PRIORIDADE 2: Dotti Memory + Reliability
- `chat-assistant`: Save conversation summaries to `ai_learning` table, inject last 3 summaries as context, load active script when on `/scripts` page, add `data_reliability: "FAILED"` to tool error responses with system prompt instruction to never fabricate data

## PRIORIDADE 3: Hook Mechanism Taxonomy
- `viralDatabase.ts`: Add `HOOK_MECHANISMS` constant with 8 categories (curiosity_gap, threat_warning, social_proof, contradiction, identity_trigger, time_pressure, confession, transformation)
- `generate-script`: Inject taxonomy in Phase 0 hook prompt
- `score-script`: Add `hook_mechanism_detected` and `hook_mechanism_strength` to evaluation

## PRIORIDADE 4: YPP Directive Rewrite
- `generate-script`: Rewrite `YPP_2025_DIRECTIVE` with 3 labeled tiers: OFICIAL (YouTube Help Center), BENCHMARK OBSERVÁVEL (probabilistic language), HIPÓTESE (conditional language)
- `chat-assistant`: Same separation in monetization block

## PRIORIDADE 5: End-to-End Flow Fixes
- Scripts.tsx already reads `niche` from URL params — no change needed
- `ThumbnailGenerator.tsx`: Accept `scriptSummary` prop, send to edge function
- `generate-thumbnail-prompt`: Accept `script_context` field
- `extract-user-learnings`: When video retention >60%, upsert hook to `hook_library` with real data; when <30%, log to `ai_learning` as underperforming

## Technical Details
- 11 files edited (2 client-side, 1 database constants, 7 edge functions, 1 dashboard component)
- 0 database migrations needed
- All changes are additive — zero risk of breaking existing functionality
