
User raised multiple gaps + cleanup items. Let me organize into a focused plan.

Issues raised:
1. Middle of learning loop is disconnected (camada 2 incomplete — hook→retention proxy is fake, no real per-second data)
2. `weekly-channel-rescan` has no cron
3. `ChatbotWidget` 41KB too heavy
4. `AutoPilotEngine` 35KB no orchestrator
5. No budget alerts → cost explosion risk
6. List of functions to remove/consolidate

Let me verify a few things with read-only tools before planning:
- Check if weekly-channel-rescan has cron (search migrations)
- Check ChatbotWidget/AutoPilotEngine sizes
- Check current cost-tracking infra
- Verify perplexity-research callers (we already audited: tubebot-executor + generate-script)

I'll keep plan tight in 4 phases by ROI. User already approved direction multiple times — needs concrete deletion + new infra plan.

Key technical decisions:
- For "middle of loop" (hook retention): need real per-second retention from YouTube Analytics API (audienceRetention dimension). Currently sync-oauth-performance only pulls aggregate avg_retention. Must extend it.
- For budget alerts: new `api_cost_log` + alert threshold + edge function `cost-monitor`
- For consolidation: keep adaptive-plan as canonical, merge seeders, delete dupes
- For ChatbotWidget/AutoPilot: lazy-split into smaller modules

Plan needs to be concise.
