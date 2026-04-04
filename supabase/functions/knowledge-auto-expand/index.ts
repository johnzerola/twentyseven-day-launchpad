import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
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

// Uses Lovable AI to generate new knowledge entries
async function aiGenerate(prompt: string, apiKey: string, toolDef: any): Promise<any> {
  const resp = await _ai({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a YouTube viral content analyst. Always respond via the tool call with precise, actionable data." },
        { role: "user", content: prompt.slice(0, 8000) },
      ],
      tools: [toolDef],
      tool_choice: { type: "function", function: { name: toolDef.function.name } },
    });
  if (!resp.ok) throw new Error(`AI ${resp.status}`);
  const data = await resp.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call");
  return JSON.parse(tc.function.arguments);
}

const EXPAND_TOOL = {
  type: "function" as const,
  function: {
    name: "expand_knowledge",
    description: "Generate new viral hooks, attention techniques, and psychology patterns for a niche",
    parameters: {
      type: "object",
      properties: {
        new_hooks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              hook_text: { type: "string" },
              hook_type: { type: "string", enum: ["curiosity", "controversy", "story", "statistic", "challenge", "pov", "mystery", "emotion"] },
              retention_score: { type: "number", minimum: 1, maximum: 10 },
              niche: { type: "string" },
            },
            required: ["hook_text", "hook_type", "retention_score", "niche"],
            additionalProperties: false,
          },
        },
        new_attention_techniques: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pattern_name: { type: "string" },
              technique: { type: "string" },
              category: { type: "string", enum: ["hook", "retention", "cliffhanger", "payoff", "transition", "emotional_peak"] },
              retention_impact: { type: "number", minimum: 0, maximum: 1 },
              psychological_basis: { type: "string" },
            },
            required: ["pattern_name", "technique", "category", "retention_impact"],
            additionalProperties: false,
          },
        },
        new_psychology_patterns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              trigger_type: { type: "string" },
              description: { type: "string" },
              example_hooks: { type: "array", items: { type: "string" } },
              example_titles: { type: "array", items: { type: "string" } },
              retention_score: { type: "integer", minimum: 1, maximum: 10 },
              niches: { type: "array", items: { type: "string" } },
            },
            required: ["trigger_type", "description", "example_hooks", "niches"],
            additionalProperties: false,
          },
        },
        new_viral_titles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              niche: { type: "string" },
              language: { type: "string" },
              hook_type: { type: "string" },
              views_estimate: { type: "integer" },
              viral_score: { type: "number", minimum: 0, maximum: 100 },
            },
            required: ["title", "niche", "language", "viral_score"],
            additionalProperties: false,
          },
        },
      },
      required: ["new_hooks", "new_attention_techniques", "new_psychology_patterns", "new_viral_titles"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get existing niches and their current knowledge counts
    const { data: niches } = await sb.from("niche_database").select("name").limit(20);
    const { data: existingHooks } = await sb.from("hook_library").select("hook_text").limit(50);
    const { data: channels } = await sb.from("channel_intelligence")
      .select("niche, channel_name, top_videos")
      .order("subscribers", { ascending: false })
      .limit(10);

    const existingHookTexts = (existingHooks || []).map((h: any) => h.hook_text).slice(0, 20);
    const nicheList = (niches || []).map((n: any) => n.name).slice(0, 15);
    const topChannelContext = (channels || []).map((c: any) => {
      const vids = Array.isArray(c.top_videos) ? c.top_videos.slice(0, 2) : [];
      return `${c.channel_name} (${c.niche}): ${vids.map((v: any) => `"${v.title}"`).join(', ')}`;
    }).join('\n');

    const prompt = `You are expanding a YouTube viral content knowledge base. Current date: ${new Date().toISOString().split('T')[0]}.

EXISTING NICHES: ${nicheList.join(', ')}

TOP PERFORMING CHANNELS RIGHT NOW:
${topChannelContext}

EXISTING HOOKS (don't repeat these):
${existingHookTexts.join(' | ')}

Generate NEW, UNIQUE content for 2026 YouTube trends:
- 10 new viral hooks (different from existing ones, covering multiple niches)
- 5 new attention engineering techniques (based on latest algorithm changes)
- 5 new audience psychology patterns (emerging behavioral trends)
- 15 new viral title formulas (multilingual: EN, PT, ES, covering trending topics)

Focus on what's TRENDING NOW in 2026: AI content, faceless channels, short-form evolution, niche-specific growth hacks.`;

    const result = await aiGenerate(prompt, GOOGLE_AI_API_KEY, EXPAND_TOOL);
    const report: Record<string, number> = { hooks: 0, attention: 0, psychology: 0, titles: 0, errors: 0 };

    // Insert new hooks
    for (const hook of (result.new_hooks || [])) {
      try {
        await sb.from("hook_library").insert({
          hook_text: hook.hook_text,
          hook_type: hook.hook_type,
          retention_score: hook.retention_score,
          niche: hook.niche,
          source_video: "auto-expand-" + new Date().toISOString().split('T')[0],
        });
        report.hooks++;
      } catch { report.errors++; }
    }

    // Insert new attention techniques
    for (const tech of (result.new_attention_techniques || [])) {
      try {
        await sb.from("attention_engineering").insert({
          pattern_name: tech.pattern_name,
          technique: tech.technique,
          category: tech.category,
          retention_impact: tech.retention_impact,
          psychological_basis: tech.psychological_basis || '',
          source: "auto-expand",
        });
        report.attention++;
      } catch { report.errors++; }
    }

    // Insert new psychology patterns
    for (const pat of (result.new_psychology_patterns || [])) {
      try {
        await sb.from("audience_psychology_patterns").insert({
          trigger_type: pat.trigger_type,
          description: pat.description,
          example_hooks: pat.example_hooks || [],
          example_titles: pat.example_titles || [],
          retention_score: pat.retention_score || 7,
          niches: pat.niches || [],
          source: "auto-expand",
        });
        report.psychology++;
      } catch { report.errors++; }
    }

    // Insert new viral titles
    for (const title of (result.new_viral_titles || [])) {
      try {
        await sb.from("viral_titles_db").insert({
          title: title.title,
          niche: title.niche,
          language: title.language || "en",
          hook_type: title.hook_type || "curiosity",
          views: title.views_estimate || 0,
          viral_score: title.viral_score,
          source: "auto-expand",
        });
        report.titles++;
      } catch { report.errors++; }
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "knowledge-auto-expand",
      success: true,
      metadata: report,
    });

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-auto-expand error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
