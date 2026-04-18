
User raises sharp critique: 115 functions ≠ squad. No structured handoff, no shared memory, no orchestrator agent. Wants real multi-agent architecture.

Already exists:
- `squad-orchestrator` (template-driven, sequential, no decision-making)
- `task-worker` (queue processor)
- `function_traces` (just built — observability layer)
- `_shared/call-fn.ts` (standardized caller with tracing)

What's missing for "real squad":
1. **Orchestrator Agent** — LLM-driven decision agent that picks next agent based on goal + context
2. **Shared memory** — agents read/write to a shared scratchpad per run
3. **Structured handoff** — typed contracts between agents (not free JSON)
4. **Already-redundant cleanup** — user listed dupes (some already deleted last turn, but `video-orchestrator`, `discover-channels-gemini` still exist)

Let me check what's already deleted vs still there, and design minimal real-squad architecture.

I won't rewrite 115 functions. I'll:
1. Build `meta-orchestrator` — single LLM agent that, given a goal ("make a viral script for niche X"), plans + executes a chain of existing functions, with shared memory.
2. Add `agent_runs` + `agent_memory` tables for shared state.
3. Define agent registry — typed manifest of what each "real agent" does (input/output schema, cost, latency).
4. Delete final dupes user mentioned.
5. UI: visualize the meta-orchestrator's decision tree (extends existing TraceWaterfall).

Keep tight.
