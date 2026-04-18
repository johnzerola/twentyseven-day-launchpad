
User raises valid architectural critique: 115 edge functions calling each other ad hoc, no central orchestration, no distributed tracing. Debugging is painful.

Let me check what observability exists already:
- `execution_logs` table exists (used by task-worker)
- `api_logs` exists
- `ai_cost_ledger` exists
- No correlation_id / trace_id pattern
- No central orchestrator — task-worker is closest but only handles queued tasks

The right fix is NOT to rewrite 115 functions. It's to add a **correlation layer** + **central tracing** + **a thin orchestrator wrapper** that wraps existing fetch calls. Minimal invasive, maximum debugging value.

Plan focuses on 3 things in order of ROI:
1. Distributed tracing (trace_id propagation + central trace table + UI viewer)
2. Standardized inter-function caller (replaces raw fetch with logged wrapper)
3. Pipeline visualization for multi-step flows (autopilot, squad-orchestrator, video pipeline)

Keep it tight.
