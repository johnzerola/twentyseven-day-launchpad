import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const callAI = async (messages: any[], tools?: any[], toolChoice?: any) => {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages,
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 429 || res.status === 402) {
    return { error: res.status === 429 ? "Rate limit. Tente novamente." : "Créditos insuficientes.", status: res.status };
  }
  if (!res.ok) throw new Error(`AI error: ${res.status}`);

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) return JSON.parse(toolCall.function.arguments);

  const content = data.choices?.[0]?.message?.content;
  if (content) {
    try { return JSON.parse(content); } catch { return { raw: content }; }
  }
  throw new Error("Empty AI response");
};

// ── Module: Brand Kit ────────────────────────────────────────────────
const handleBrandKit = async (niche: string) => {
  return callAI(
    [
      { role: "system", content: "You are a YouTube branding expert. Generate channel names, color palettes, and visual prompts. Respond in Portuguese." },
      { role: "user", content: `Create a brand kit for the niche: "${niche}". Generate 3 channel name options with tagline, reasoning, and Midjourney prompts for logo, banner, thumbnail. Plus 5-color palettes for each.` },
    ],
    [{
      type: "function",
      function: {
        name: "generate_brand_kit",
        description: "Generate brand kit with names, palettes, and prompts",
        parameters: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" }, tagline: { type: "string" }, reason: { type: "string" },
                  logoPrompt: { type: "string" }, bannerPrompt: { type: "string" }, thumbnailPrompt: { type: "string" },
                },
                required: ["name", "tagline", "reason", "logoPrompt", "bannerPrompt", "thumbnailPrompt"],
              },
            },
            palettes: {
              type: "array",
              items: { type: "array", items: { type: "object", properties: { hex: { type: "string" }, usage: { type: "string" } }, required: ["hex", "usage"] } },
            },
          },
          required: ["names", "palettes"],
        },
      },
    }],
    { type: "function", function: { name: "generate_brand_kit" } }
  );
};

// ── Module: Thumbnail Lab ────────────────────────────────────────────
const handleThumbnailLab = async (niche: string) => {
  return callAI(
    [
      { role: "system", content: "You are a YouTube thumbnail psychology expert who has tested 50,000+ thumbnails. You understand color psychology, facial expressions, composition rules, curiosity gaps, and CTR optimization. Respond in Portuguese." },
      { role: "user", content: `Generate 4 high-CTR thumbnail concepts for the niche "${niche}". Each concept needs a title, description of the visual, a Midjourney/DALL-E prompt, an estimated CTR score (1-10), and a psychology tip explaining WHY it works.` },
    ],
    [{
      type: "function",
      function: {
        name: "generate_thumbnails",
        description: "Generate thumbnail concepts with CTR scores",
        parameters: {
          type: "object",
          properties: {
            concepts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" }, description: { type: "string" },
                  prompt: { type: "string" }, ctrScore: { type: "number" },
                  psychologyTip: { type: "string" },
                },
                required: ["title", "description", "prompt", "ctrScore", "psychologyTip"],
              },
            },
          },
          required: ["concepts"],
        },
      },
    }],
    { type: "function", function: { name: "generate_thumbnails" } }
  );
};

// ── Module: Growth Checklist ─────────────────────────────────────────
const handleGrowthChecklist = async (stage: string) => {
  const stageLabel = stage === "0" ? "0 subscribers (brand new)" : stage === "1000" ? "~1,000 subscribers" : stage === "10000" ? "~10,000 subscribers" : "100,000+ subscribers";
  return callAI(
    [
      { role: "system", content: "You are a YouTube growth strategist who has monetized 25,000+ channels. Create actionable checklists adapted to the channel stage. Respond in Portuguese." },
      { role: "user", content: `Generate a growth checklist of 10-15 items for a channel at stage: ${stageLabel}. Each item needs a unique id (slug), title, description, priority (alta/média/baixa), and optionally a relevant platform module name.` },
    ],
    [{
      type: "function",
      function: {
        name: "generate_checklist",
        description: "Generate growth checklist items",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" }, title: { type: "string" },
                  description: { type: "string" }, priority: { type: "string", enum: ["alta", "média", "baixa"] },
                  module: { type: "string" },
                },
                required: ["id", "title", "description", "priority"],
              },
            },
          },
          required: ["items"],
        },
      },
    }],
    { type: "function", function: { name: "generate_checklist" } }
  );
};

// ── Module: Content Matrix ───────────────────────────────────────────
const handleContentMatrix = async (niche: string) => {
  return callAI(
    [
      { role: "system", content: "You are a YouTube content strategist specializing in growth optimization and format mix. Respond in Portuguese." },
      { role: "user", content: `For the niche "${niche}", generate: 1) Format distribution (long-form, shorts, community posts, etc.) with percentages. 2) 7 weekly content suggestions with day, title, format, and duration. 3) A strategy tip explaining the rationale.` },
    ],
    [{
      type: "function",
      function: {
        name: "generate_content_matrix",
        description: "Generate content format distribution and weekly plan",
        parameters: {
          type: "object",
          properties: {
            formats: {
              type: "array",
              items: { type: "object", properties: { type: { type: "string" }, percentage: { type: "number" } }, required: ["type", "percentage"] },
            },
            weeklySuggestions: {
              type: "array",
              items: {
                type: "object",
                properties: { day: { type: "string" }, title: { type: "string" }, format: { type: "string" }, duration: { type: "string" } },
                required: ["day", "title", "format", "duration"],
              },
            },
            strategyTip: { type: "string" },
          },
          required: ["formats", "weeklySuggestions", "strategyTip"],
        },
      },
    }],
    { type: "function", function: { name: "generate_content_matrix" } }
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { module, niche, stage } = await req.json();

    let result: any;

    switch (module) {
      case "brand-kit":
        result = await handleBrandKit(niche || "geral");
        break;
      case "thumbnail-lab":
        result = await handleThumbnailLab(niche || "geral");
        break;
      case "growth-checklist":
        result = await handleGrowthChecklist(stage || "0");
        break;
      case "content-matrix":
        result = await handleContentMatrix(niche || "geral");
        break;
      default:
        // Legacy: full strategy (backward compat)
        result = await handleBrandKit(niche || "geral");
    }

    if (result?.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-branding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
