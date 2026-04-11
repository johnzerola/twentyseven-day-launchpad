import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// COST OPTIMIZATION: Use Gemini Pro direct (via callGeminiOpenAICompat) instead of GPT-5 through gateway
const AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Migrated to Gemini Direct via _shared/gemini-direct.ts

// ═══════════════════════════════════════════════════════════════
// ENGINE 4: VIRAL CREATION ENGINE
// Orchestrates all engines to generate HIGH-PROBABILITY viral content
//
// Flow:
//   1. Query content_dna for niche patterns (Engine 2 output)
//   2. Query viral_patterns + hook_library (Engine 1 output)  
//   3. Run attention engineering prediction (Engine 3)
//   4. Generate NEW viral concept, hook, narrative & script outline
//
// This does NOT generate the full script (that's generate-script).
// This generates the CONCEPT + BLUEPRINT that feeds generate-script.
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get("authorization") || '';
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _authSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _authErr } = await _authSb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authErr || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      niche, language = "pt", video_type = "long",
      topic_seed,
      style,
      duration = 15,
      count = 3,
    } = await req.json();

    if (!niche) throw new Error("niche is required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // COST OPTIMIZATION: Use Gemini direct API (zero cost) instead of GPT-5 gateway
    const aiH = { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" };
    const isShort = video_type === "short";

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: GATHER INTELLIGENCE (parallel queries)
    // ═══════════════════════════════════════════════════════════
    const [
      dnaRes, patternsRes, hooksRes, titlesRes, psychRes,
      attEngRes, modelsRes, structRes, nicheRes
    ] = await Promise.all([
      // Engine 2 output: Content DNA patterns for this niche
      sb.from("content_dna")
        .select("hook_type,hook_pattern,hook_strength,story_structure,pacing,emotion_primary,psychological_triggers,attention_score,curiosity_score,dopamine_score,why_viral,replication_template,video_title,views,multiplier")
        .eq("niche", niche)
        .order("viral_score", { ascending: false })
        .limit(15),

      // Engine 1 output: Viral patterns
      sb.from("viral_patterns")
        .select("pattern_name,pattern_json,niche")
        .or(`niche.eq.${niche},niche.eq.general`)
        .limit(10),

      // Hook library (top performers)
      sb.from("hook_library")
        .select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false })
        .limit(20),

      // Viral titles for inspiration
      sb.from("viral_titles_db")
        .select("title,views,why_viral,title_pattern,niche,emotional_triggers")
        .eq("niche", niche)
        .order("views", { ascending: false })
        .limit(15),

      // Psychology patterns
      sb.from("audience_psychology_patterns")
        .select("trigger_type,description,example_hooks,retention_score")
        .order("retention_score", { ascending: false })
        .limit(10),

      // Engine 3: Attention engineering techniques
      sb.from("attention_engineering")
        .select("pattern_name,technique,retention_impact,psychological_basis,category")
        .order("retention_impact", { ascending: false })
        .limit(10),

      // Content models
      sb.from("content_models")
        .select("model_name,description,hook_pattern,retention_profile,effectiveness_score")
        .eq("video_type", isShort ? "short" : "long")
        .order("effectiveness_score", { ascending: false })
        .limit(5),

      // Script structures
      sb.from("script_structures")
        .select("structure_name,intro_pattern,cliffhanger_pattern,avg_retention")
        .order("effectiveness_score", { ascending: false })
        .limit(5),

      // Niche data
      sb.from("niche_database")
        .select("name,rpm_estimate,difficulty,saturation,sub_niches")
        .eq("name", niche)
        .maybeSingle(),
    ]);

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: FORMAT INTELLIGENCE FOR AI
    // ═══════════════════════════════════════════════════════════
    const dnaData = dnaRes.data || [];
    const dnaBlock = dnaData.length > 0
      ? dnaData.map((d: any, i: number) =>
        `${i + 1}. "${d.video_title}" (${(d.views || 0).toLocaleString()} views, ${d.multiplier || 0}x)\n` +
        `   Hook: [${d.hook_type}] "${d.hook_pattern || ''}"\n` +
        `   Structure: ${d.story_structure} | Pacing: ${d.pacing}\n` +
        `   Emotion: ${d.emotion_primary} | Triggers: ${(d.psychological_triggers || []).join(', ')}\n` +
        `   Scores: Attention=${d.attention_score}/10 Curiosity=${d.curiosity_score}/10 Dopamine=${d.dopamine_score}/10\n` +
        `   Why viral: ${d.why_viral || 'N/A'}\n` +
        `   Replication: ${d.replication_template || 'N/A'}`
      ).join("\n\n")
      : "No DNA data yet for this niche.";

    const hooksBlock = (hooksRes.data || [])
      .filter((h: any) => h.niche === niche || !h.niche)
      .slice(0, 10)
      .map((h: any) => `• [${h.hook_type}] "${h.hook_text}" (score: ${h.retention_score}/10)`)
      .join("\n");

    const titlesBlock = (titlesRes.data || [])
      .map((t: any) => `• "${t.title}" (${(t.views || 0).toLocaleString()} views) — Pattern: ${t.title_pattern || '?'} | Why: ${t.why_viral || 'N/A'}`)
      .join("\n");

    const patternsBlock = (patternsRes.data || [])
      .map((p: any) => {
        const j = p.pattern_json || {};
        return `• ${p.pattern_name}: Hook=${j.hook_type || '?'} Structure=${j.story_structure || '?'} Pacing=${j.pacing || '?'}`;
      }).join("\n");

    const psychBlock = (psychRes.data || [])
      .map((p: any) => `• ${p.trigger_type}: ${(p.description || '').slice(0, 120)}`)
      .join("\n");

    const attBlock = (attEngRes.data || [])
      .map((a: any) => `• ${a.pattern_name} [${a.category}]: ${(a.technique || '').slice(0, 100)} (impact: ${a.retention_impact}%)`)
      .join("\n");

    const modelsBlock = (modelsRes.data || [])
      .map((m: any) => `• ${m.model_name}: ${(m.description || '').slice(0, 100)} (score: ${m.effectiveness_score}/10)`)
      .join("\n");

    const nicheInfo = nicheRes.data
      ? `RPM: $${nicheRes.data.rpm_estimate || '?'} | Difficulty: ${nicheRes.data.difficulty || '?'} | Saturation: ${nicheRes.data.saturation || '?'}`
      : "Niche data not available";

    // Calculate dominant patterns from DNA
    const hookTypeFreq: Record<string, number> = {};
    const storyFreq: Record<string, number> = {};
    const emotionFreq: Record<string, number> = {};
    for (const d of dnaData) {
      hookTypeFreq[d.hook_type] = (hookTypeFreq[d.hook_type] || 0) + 1;
      storyFreq[d.story_structure] = (storyFreq[d.story_structure] || 0) + 1;
      if (d.emotion_primary) emotionFreq[d.emotion_primary] = (emotionFreq[d.emotion_primary] || 0) + 1;
    }
    const dominantHook = Object.entries(hookTypeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "curiosity_gap";
    const dominantStory = Object.entries(storyFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "escalating_stakes";
    const dominantEmotion = Object.entries(emotionFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "curiosity";

    const avgScores = dnaData.length > 0 ? {
      attention: (dnaData.reduce((s: number, d: any) => s + (d.attention_score || 0), 0) / dnaData.length).toFixed(1),
      curiosity: (dnaData.reduce((s: number, d: any) => s + (d.curiosity_score || 0), 0) / dnaData.length).toFixed(1),
      dopamine: (dnaData.reduce((s: number, d: any) => s + (d.dopamine_score || 0), 0) / dnaData.length).toFixed(1),
    } : { attention: "?", curiosity: "?", dopamine: "?" };

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: VIRAL CONCEPT GENERATION (GPT-5)
    // ═══════════════════════════════════════════════════════════
    const conceptRes = await fetch(`${AI_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are the VIRAL CREATION ENGINE — an AI system that generates NEW video concepts with HIGH viral probability.

You have access to the CONTENT DNA of ${dnaData.length} viral videos in the "${niche}" niche.

═══ NICHE INTELLIGENCE ═══
${nicheInfo}
Dominant hook type: ${dominantHook}
Dominant story structure: ${dominantStory}
Dominant emotion: ${dominantEmotion}
Avg scores: Attention=${avgScores.attention} Curiosity=${avgScores.curiosity} Dopamine=${avgScores.dopamine}
DNA samples analyzed: ${dnaData.length}

═══ CONTENT DNA DATABASE (what works in "${niche}") ═══
${dnaBlock}

═══ PROVEN HOOKS (top performers) ═══
${hooksBlock || "No niche-specific hooks yet."}

═══ VIRAL TITLES (real data) ═══
${titlesBlock || "No niche-specific titles yet."}

═══ VIRAL PATTERNS ═══
${patternsBlock || "No patterns yet."}

═══ PSYCHOLOGY TRIGGERS ═══
${psychBlock || "No psychology data yet."}

═══ ATTENTION ENGINEERING ═══
${attBlock || "No attention techniques yet."}

═══ CONTENT MODELS ═══
${modelsBlock || "No models yet."}

═══ YOUR MISSION ═══
Generate ${count} NEW video concepts that:
1. USE the dominant patterns (hook=${dominantHook}, structure=${dominantStory}, emotion=${dominantEmotion})
2. BUT add a UNIQUE ANGLE that differentiates from existing videos
3. Each concept must have a predicted attention/curiosity/dopamine score ≥ 7/10
4. Each concept must include a COMPLETE hook (first 5-10 seconds word-by-word)
5. Each concept must include a NARRATIVE SKELETON (not full script, but the arc)
6. NEVER copy existing titles — create NEW ones using proven patterns
7. Language: ${language}
8. Format: ${isShort ? "SHORT (20-60 seconds)" : `LONG-FORM (${duration} minutes)`}
${topic_seed ? `9. Topic direction: "${topic_seed}" (use as seed, expand creatively)` : ""}
${style ? `10. Style: ${style}` : ""}

${isShort ? `
═══ SHORTS MONETIZATION STRATEGY — DATA-DRIVEN 30-DAY PLAN ═══
Based on real case studies and algorithm research (2025-2026):

📊 CASE STUDY #1 (Kood Blog): 2 Shorts → 150K views + 1K subs in 12 days
  KEY RULE: "Never upload a new Short while the previous is still being pushed by the algorithm."
  UPLOAD RULE: Wait until your last Short drops below 100 views/hour for at least 12 hours before posting another.

📊 CASE STUDY #2: 300 Shorts in 30 days → only 318 subs and 131K views
  LESSON: Quantity WITHOUT quality = waste. 10 shorts/day with bad retention = algorithm death.

📊 CASE STUDY #3 (SaaS Channel): 5 Shorts/day → 925 subs in 28 days (+999% growth)
  BUT: Only worked AFTER finding ONE proven repeatable format with 200%+ avg viewed.

📊 ALGORITHM UPDATE (Tubefilter, Dec 2025 / SEJ 2026):
  - YouTube Shorts algorithm now FAVORS fresh content over evergreen
  - Shorts older than 28-30 days are being deprioritized in recommendations
  - This means CONSISTENT posting matters more than ever — but smart posting, not spam

═══ CANNIBALIZATION WARNING ═══
CRITICAL: Posting multiple Shorts per day TOO EARLY kills growth. Real data shows:
- Each Short competes with YOUR OWN previous Shorts for the algorithm's attention
- If Short #1 is being pushed and you upload Short #2, BOTH get reduced reach
- The algorithm needs time to "learn" your audience before scaling up
- New channels posting 3+/day in week 1 show LOWER per-video performance than 1/day channels

═══ PHASED RAMP-UP STRATEGY (the proven approach) ═══

PHASE 1 — CALIBRATION (Days 1-7): 1 Short per day MAX
  Purpose: Let the algorithm learn your content profile and find your audience
  Rules:
  - Post at the SAME TIME every day (build predictability signal)
  - Monitor: completion rate, swipe-away rate, and subscriber conversion
  - Do NOT post a new Short until the previous one has peaked (check if views/hour < 100 for 12h)
  - If a Short goes viral (10K+ views), DO NOT upload next day — let it ride
  - Reply to EVERY comment within the first hour (engagement signal)
  - Focus: Find what WORKS (topic + hook + format combination)
  
PHASE 2 — ACCELERATION (Days 8-20): 1-2 Shorts per day
  Unlock condition: At least 2 Shorts from Phase 1 achieved >50% retention
  Rules:
  - Double down on the format/topic that performed best
  - Space uploads 6-8 hours apart if posting 2/day
  - Create "series" from your best performer (same hook structure, new angle)
  - Every 5th Short: reference a previous Short to drive binge-watching
  - Start building "content clusters" (3-5 Shorts around same topic)
  - Track: which topic clusters get the most subscriber conversions

PHASE 3 — SCALE (Days 21-30): 2-3 Shorts per day (ONLY if data supports it)
  Unlock condition: Average retention >50% AND subscriber growth is consistent
  Rules:
  - Scale ONLY the proven format — do NOT experiment with new formats at high volume
  - Use the "spin-off" technique: take your top 3 Shorts, create 3 variations of each
  - Space uploads 4-6 hours apart
  - Monitor daily: if per-Short views DROP when posting 3/day, go back to 2/day
  - Create "compilation hooks" that tease best moments from previous Shorts
  - Cross-pollinate: Shorts should reference each other ("Parte 2 de...")

═══ CONTENT REQUIREMENTS FOR EACH SHORT ═══
- Hook in FIRST 1 SECOND (not 3, not 2 — ONE second)
- Loop-ending: the last frame must make viewers want to rewatch (target 200%+ avg viewed)
- Emotional peak within first 5 seconds
- PATTERN INTERRUPT every 8-10 seconds
- Information density: one surprising fact per 5 seconds minimum
- Target: 80%+ retention rate (not 90% — be realistic), 5%+ share rate
- Include a LOOP STRATEGY: how the ending connects back to start
- Include COMMENT BAIT: a controversial or debatable element
- Use "micro-cliffhanger" technique: reveal 80% of answer, hold 20%
- Optimize for YouTube Shorts shelf algorithm: engaging first frame = thumbnail
- Include SERIES POTENTIAL: how this becomes 10+ related Shorts (content cluster)
- Target niches with LOW competition but HIGH RPM for Shorts

═══ ANTI-CANNIBALIZATION RULES ═══
- NEVER upload 2 Shorts within 4 hours of each other
- If a Short gets 5K+ views in first 2 hours → PAUSE next upload, let it ride
- If 3 consecutive Shorts get <500 views → STOP, analyze, adjust format before continuing
- Weekend posting: reduce to 1/day (lower competition = better per-Short reach)
- First Short of the day = your STRONGEST concept. Second = experimental/series

═══ SUCCESS METRICS BY WEEK ═══
Week 1: 7 Shorts → Target: 50+ subs, identify best-performing format
Week 2: 10-14 Shorts → Target: 150+ total subs, double down on winners
Week 3: 14-18 Shorts → Target: 400+ total subs, content clusters established
Week 4: 14-21 Shorts → Target: 1,000+ subs (YPP subscriber threshold)
Total: 45-60 quality Shorts in 30 days (NOT 90-150 spam Shorts)

KEY INSIGHT: It's not about posting MORE — it's about posting SMARTER.
The algorithm rewards channels that maintain high retention CONSISTENTLY.
One viral Short (50K+ views) = more growth than 50 mediocre Shorts.
` : ""}`
          },
          {
            role: "user",
            content: `Generate ${count} viral video concepts for the "${niche}" niche.${topic_seed ? ` Seed topic: "${topic_seed}"` : ""}\nUse the Content DNA patterns to maximize viral probability.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_viral_concepts",
            parameters: {
              type: "object",
              properties: {
                concepts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Viral title for the video" },
                      hook_text: { type: "string", description: "Word-by-word first 5-10 seconds" },
                      hook_type: { type: "string" },
                      topic: { type: "string", description: "Core topic/angle" },
                      unique_angle: { type: "string", description: "What makes this different from existing content" },
                      story_structure: { type: "string" },
                      narrative_skeleton: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            segment: { type: "string" },
                            purpose: { type: "string" },
                            duration_pct: { type: "number" },
                            technique: { type: "string" },
                          }
                        }
                      },
                      emotional_journey: { type: "array", items: { type: "string" } },
                      psychological_triggers: { type: "array", items: { type: "string" } },
                      thumbnail_concept: { type: "string" },
                      predicted_attention_score: { type: "number" },
                      predicted_curiosity_score: { type: "number" },
                      predicted_dopamine_score: { type: "number" },
                      predicted_retention: { type: "number" },
                      viral_probability: { type: "number", description: "0-100" },
                      content_model: { type: "string" },
                      why_this_will_work: { type: "string" },
                      anti_spam_check: { type: "boolean", description: "True if content seems human and not AI-generic" },
                    },
                     required: ["title", "hook_text", "hook_type", "topic", "unique_angle", "story_structure", "narrative_skeleton", "predicted_attention_score", "predicted_curiosity_score", "predicted_dopamine_score", "viral_probability", "why_this_will_work"],
                     additionalProperties: false,
                  },
                },
                niche_summary: {
                  type: "object",
                  properties: {
                    total_dna_analyzed: { type: "number" },
                    dominant_patterns: { type: "string" },
                    market_gap_identified: { type: "string" },
                    recommended_posting_frequency: { type: "string" },
                  }
                }
              },
              required: ["concepts", "niche_summary"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_viral_concepts" } },
      }),
    });

    let result: any = { concepts: [], niche_summary: {} };
    if (conceptRes.ok) {
      const data = await conceptRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) result = JSON.parse(tc.function.arguments);
    } else {
      const errText = await conceptRes.text();
      console.error("Viral creation AI error:", conceptRes.status, errText);
      throw new Error(`AI concept generation failed: ${conceptRes.status}`);
    }

    // ═══ PERSIST: Save concepts to content_queue for the user ═══
    // (concepts are suggestions, not yet committed to production)

    // Log
    await sb.from("execution_logs").insert({
      function_name: "viral-creation-engine",
      success: true,
      duration_ms: Date.now() - startTime,
      api_calls_made: 1,
      metadata: {
        niche,
        dna_samples: dnaData.length,
        concepts_generated: result.concepts?.length || 0,
        dominant_patterns: { hook: dominantHook, story: dominantStory, emotion: dominantEmotion },
        avg_predicted_scores: result.concepts?.length > 0 ? {
          attention: (result.concepts.reduce((s: number, c: any) => s + (c.predicted_attention_score || 0), 0) / result.concepts.length).toFixed(1),
          curiosity: (result.concepts.reduce((s: number, c: any) => s + (c.predicted_curiosity_score || 0), 0) / result.concepts.length).toFixed(1),
          dopamine: (result.concepts.reduce((s: number, c: any) => s + (c.predicted_dopamine_score || 0), 0) / result.concepts.length).toFixed(1),
        } : null,
      },
    }).catch(() => {});

    // Save top concepts to ai_learning for self-improvement
    if (result.concepts?.length > 0) {
      await sb.from("ai_learning").insert({
        topic: `viral_creation_${niche}_${Date.now()}`,
        source: "viral-creation-engine",
        insight: JSON.stringify({
          niche,
          concepts_count: result.concepts.length,
          dna_samples_used: dnaData.length,
          dominant_patterns: { hook: dominantHook, story: dominantStory, emotion: dominantEmotion },
          top_concept_title: result.concepts[0]?.title,
          top_viral_probability: result.concepts[0]?.viral_probability,
          niche_summary: result.niche_summary,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true,
      concepts: result.concepts || [],
      niche_summary: result.niche_summary || {},
      intelligence: {
        dna_samples: dnaData.length,
        hooks_available: (hooksRes.data || []).length,
        viral_titles_available: (titlesRes.data || []).length,
        patterns_available: (patternsRes.data || []).length,
        dominant_hook: dominantHook,
        dominant_story: dominantStory,
        dominant_emotion: dominantEmotion,
        avg_scores: avgScores,
      },
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("viral-creation-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
