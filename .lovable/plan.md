
User raises two distinct gaps:

**Gap 1: Reference channels → script generation is broken**
- `refresh-references` exists, runs weekly via cron (verified earlier)
- `latest_intel` stored as JSON in `user_reference_channels`
- BUT: `generate-script` doesn't auto-fetch reference intel — frontend must pass `intelligenceBriefing` explicitly
- `reference-intel-injector.ts` exists in _shared but is it called automatically? Need to verify
- Missing: vector embeddings of intel + RAG retrieval + post-gen fidelity score
- Missing roles: `competitor`, `benchmark`, `anti-model`

**Gap 2: No consolidated cost dashboard**
- `AiCostPanel` exists (per-provider + per-function from `ai_cost_ledger`)
- User wants money values per agent visible
- This is mostly DONE already — but maybe needs surfacing/improvement

Let me focus on Gap 1 (the real meat). For Gap 2, the panel exists; just confirm and link.

Plan structure:
1. Auto-injection of reference intel in generate-script (no frontend dependency)
2. Embed intel into knowledge_embeddings → RAG retrieval at gen-time
3. Expand role enum: add `competitor`, `benchmark`, `anti-model`
4. Post-gen fidelity score
5. Confirm cost panel already covers Gap 2

Keep concise.
