import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batchSize = 50, sourceTable = 'viral_titles_db' } = await req.json().catch(() => ({}));
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch viral titles to extract hooks from
    const { data: titles, error } = await sb
      .from("viral_titles_db")
      .select("id, title, views, niche, emotional_triggers, title_pattern, why_viral")
      .order("views", { ascending: false })
      .limit(batchSize);

    if (error || !titles?.length) throw new Error("No titles found");

    // Get existing hook patterns to avoid duplicates
    const { data: existing } = await sb.from("hook_patterns").select("pattern_name");
    const existingNames = new Set((existing || []).map((e: any) => e.pattern_name));

    // Group titles by niche for better pattern extraction
    const nicheGroups: Record<string, any[]> = {};
    for (const t of titles) {
      const n = t.niche || 'general';
      if (!nicheGroups[n]) nicheGroups[n] = [];
      nicheGroups[n].push(t);
    }

    const results: any[] = [];

    for (const [niche, nicheItems] of Object.entries(nicheGroups).slice(0, 10)) {
      const titlesText = nicheItems.slice(0, 10).map((t: any) => 
        `"${t.title}" (${t.views} views, triggers: ${(t.emotional_triggers || []).join(', ')}, pattern: ${t.title_pattern || 'N/A'})`
      ).join('\n');

      const prompt = `Analyze these viral YouTube titles from the "${niche}" niche and extract REUSABLE hook patterns.

VIRAL TITLES:
${titlesText}

For each title, extract the hook PATTERN (not the specific content). Create 3-5 hook patterns with:
1. A descriptive pattern_name (e.g., "Impossible Number Reveal", "Hidden Truth Countdown")
2. The pattern_type (question, statement, number, challenge, mystery, controversy, emotional)
3. A reusable template with [VARIABLE] placeholders
4. The psychology trigger (curiosity_gap, fear_of_missing, social_proof, authority, scarcity, contrast)
5. Estimated retention boost percentage (5-25%)

Respond ONLY in JSON array:
[{
  "pattern_name": "...",
  "pattern_type": "...",
  "template": "...",
  "psychology_trigger": "...",
  "avg_retention_boost": N,
  "best_for_niches": ["niche1"],
  "effectiveness_score": N,
  "example_hooks": [{"hook": "...", "views": N}]
}]`;

      try {
        const aiRes = await _ai({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Extract hook patterns from viral titles. Respond ONLY in valid JSON array." },
              { role: "user", content: prompt },
            ],
          });

        if (!aiRes.ok) continue;
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '[]';
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const patterns = JSON.parse(jsonStr);

        for (const p of patterns) {
          if (existingNames.has(p.pattern_name)) continue;
          
          const { error: insertErr } = await sb.from("hook_patterns").insert({
            pattern_name: p.pattern_name,
            pattern_type: p.pattern_type || 'statement',
            template: p.template || '',
            psychology_trigger: p.psychology_trigger || 'curiosity_gap',
            avg_retention_boost: p.avg_retention_boost || 10,
            best_for_niches: p.best_for_niches || [niche],
            effectiveness_score: p.effectiveness_score || 7,
            example_hooks: p.example_hooks || [],
            source: 'auto-expand',
          });

          if (!insertErr) {
            existingNames.add(p.pattern_name);
            results.push({ pattern_name: p.pattern_name, niche });
          }
        }

        // Rate limit between niches
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`Error processing niche ${niche}:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      new_patterns: results.length,
      patterns: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("expand-hook-patterns error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
