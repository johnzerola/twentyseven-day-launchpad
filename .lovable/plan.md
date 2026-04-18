
User wants to economize tokens/API credits by ensuring auto-running systems execute only once per day OR every 48h max. Let me check current cron schedule.

From context I already saw `auto-intelligence-cron/index.ts` — it consolidated everything into a single daily run at 06:00 UTC. But I need to verify the actual pg_cron schedules in DB and check if there are multiple cron jobs firing.

Let me check.
