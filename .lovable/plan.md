
User raises sharp, valid concern: instruction dilution. 15k+ tokens of system prompt → Flash follows first 30%, ignores last 40%. Real research-backed problem.

Let me check current state of generate-script before planning.

The fix isn't to dumb down the prompt — it's to **layer/route** instructions intelligently:
1. **Tier 1 (always-on, ~2k tokens)**: hard rules, format, anti-slop, language
2. **Tier 2 (conditional, ~3k tokens)**: only inject blueprints/structures relevant to chosen style+duration
3. **Tier 3 (post-hoc validators)**: instead of prompting "don't do X", run cheap validator passes after generation that catch + auto-repair

Plan = three concrete moves:
1. **Prompt sharding**: split monolithic prompt into modules, dynamically compose only relevant ones
2. **Multi-pass with specialist roles**: instead of one Flash call doing everything, chain 2-3 cheaper focused passes (hook specialist → body writer → retention auditor)
3. **Validator + repair loop**: post-gen checks (anti-slop regex, dopamine count, hook strength) → if fails, surgical repair pass on just the broken section

This actually aligns with the meta-orchestrator we just built — generate-script becomes a mini-squad.

Keep tight.
