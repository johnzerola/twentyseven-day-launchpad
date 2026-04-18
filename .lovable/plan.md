
User wants Phase 2 cleanup: consolidate/delete duplicate edge functions. Let me audit the actual duplicates and present a focused deletion+merge plan.

Key duplicates confirmed by user + my earlier audit:
1. video-orchestrator (DEPRECATED in code)
2. find-competitors → keep find-competitors-ai
3. generate-script-short → merge into generate-script (with `format: 'short'` flag)
4. generate-30day-plan + generate-adaptive-plan → merge into generate-plan
5. seed-complete-knowledge + seed-elite-knowledge + seed-reference-channels → merge into data-seeding-engine (parametrized)
6. self-learning-worker → merge into self-learning-engine
7. discover-viral-channels + discover-channels-gemini + detect-emerging-channels → merge into single discover-channels
8. Plus generate-scenes-short, learn-from-user, extract-user-learnings, analyze-viral-channels, gemini-bulk-seeder

Need to check:
- Which functions are called from frontend (search src/)
- Which are called by CRONs / other functions
- What params differ

I'll plan the safe consolidation: each merge needs (a) router param added to "winner" function, (b) frontend invoke calls updated, (c) cron config updated, (d) old function deleted.

Keep plan concise — user already approved overall direction in earlier message.
