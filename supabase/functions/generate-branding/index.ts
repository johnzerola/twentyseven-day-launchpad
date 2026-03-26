import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const callAI = async (messages: any[], tools?: any[], toolChoice?: any) => {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const body: any = { model: "google/gemini-3-flash-preview", messages };
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

// ── Fetch real data from DB ──────────────────────────────────────────
const fetchRealData = async (niche?: string, country?: string) => {
  // Get real viral titles data for this niche
  let viralQuery = supabase.from("viral_titles_db").select("title, views, likes, channel_name, niche, country, why_viral, title_pattern, emotional_triggers").order("views", { ascending: false }).limit(30);
  if (niche) viralQuery = viralQuery.ilike("niche", `%${niche}%`);
  
  // Get real channel intelligence
  let channelQuery = supabase.from("channel_intelligence").select("channel_name, subscribers, avg_views, niche, country, growth_rate, rpm_estimate, upload_frequency, style, is_faceless").order("avg_views", { ascending: false }).limit(20);
  if (niche) channelQuery = channelQuery.ilike("niche", `%${niche}%`);

  const [viralRes, channelRes] = await Promise.all([viralQuery, channelQuery]);
  
  return {
    viralTitles: viralRes.data || [],
    channels: channelRes.data || [],
  };
};

// ── Module: Revenue Simulator (REAL DATA) ────────────────────────────
const handleRevenueSimulator = async (niche: string, country: string, uploadsPerWeek: number, avgViews: number, channelData?: any) => {
  const realData = await fetchRealData(niche);
  
  // Calculate real RPM from channel intelligence
  const channelsWithRpm = realData.channels.filter((c: any) => c.rpm_estimate > 0);
  const realAvgRpm = channelsWithRpm.length > 0 
    ? channelsWithRpm.reduce((s: number, c: any) => s + Number(c.rpm_estimate), 0) / channelsWithRpm.length 
    : null;
  
  // Get real growth rates
  const growthRates = realData.channels.map((c: any) => c.growth_rate);
  const fastGrowing = realData.channels.filter((c: any) => c.growth_rate === 'explosive' || c.growth_rate === 'fast');
  
  // Get real viral patterns
  const topViralTitles = realData.viralTitles.slice(0, 10).map((t: any) => ({
    title: t.title, views: t.views, pattern: t.title_pattern, triggers: t.emotional_triggers,
  }));

  const prompt = `Você é um analista de dados do YouTube com acesso a dados REAIS de canais monetizados.

DADOS REAIS DO BANCO DE DADOS:
- ${realData.channels.length} canais reais analisados no nicho "${niche}"
- RPM médio REAL medido: ${realAvgRpm ? `$${realAvgRpm.toFixed(2)}` : 'não disponível para este nicho'}
- Canais em crescimento rápido: ${fastGrowing.length}/${realData.channels.length}
- Top canais: ${realData.channels.slice(0, 5).map((c: any) => `${c.channel_name} (${c.subscribers} subs, ${c.avg_views} avg views, RPM $${c.rpm_estimate})`).join('; ')}
- ${realData.viralTitles.length} títulos virais analisados
- Top vídeos virais: ${topViralTitles.slice(0, 5).map((t: any) => `"${t.title}" (${t.views} views)`).join('; ')}

PARÂMETROS DO USUÁRIO:
- Nicho: ${niche}
- País da audiência: ${country}
- Uploads por semana: ${uploadsPerWeek}
- Views médias esperadas: ${avgViews}
${channelData ? `- Canal existente: ${channelData.channel_name} com ${channelData.subscribers} subs e ${channelData.views} views totais` : '- Canal novo (0 subs)'}

Baseado nos DADOS REAIS acima, gere uma projeção de 12 meses REALISTA. Não invente números — use os RPMs reais dos canais do banco de dados. Se não houver dados de RPM, use estimativas conservadoras baseadas no país.

IMPORTANTE: Seja HONESTO. Se o nicho tem RPM baixo, diga isso. Se as expectativas são irrealistas, avise.`;

  return callAI(
    [
      { role: "system", content: "Analista de dados YouTube. Use APENAS dados reais fornecidos. Responda em português." },
      { role: "user", content: prompt },
    ],
    [{
      type: "function",
      function: {
        name: "generate_revenue_projection",
        description: "Generate 12-month revenue projection based on real data",
        parameters: {
          type: "object",
          properties: {
            realRpm: { type: "number", description: "Real RPM based on actual data" },
            rpmSource: { type: "string", description: "Where the RPM came from (real channels or estimate)" },
            honestAssessment: { type: "string", description: "Honest assessment of the channel's monetization potential" },
            months: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  month: { type: "number" },
                  views: { type: "number" },
                  adsenseRevenue: { type: "number" },
                  affiliateRevenue: { type: "number" },
                  infoproductRevenue: { type: "number" },
                  totalRevenue: { type: "number" },
                  projectedSubs: { type: "number" },
                  milestone: { type: "string" },
                },
                required: ["month", "views", "adsenseRevenue", "totalRevenue", "projectedSubs"],
              },
            },
            revenueStreams: {
              type: "array",
              items: {
                type: "object",
                properties: { source: { type: "string" }, startMonth: { type: "number" }, monthlyEstimate: { type: "string" }, tip: { type: "string" } },
                required: ["source", "startMonth", "monthlyEstimate"],
              },
            },
            competitorBenchmark: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, subs: { type: "number" }, avgViews: { type: "number" }, rpm: { type: "number" } },
                required: ["name", "subs", "avgViews"],
              },
            },
            viralOpportunities: {
              type: "array",
              items: {
                type: "object",
                properties: { title: { type: "string" }, pattern: { type: "string" }, estimatedViews: { type: "string" } },
                required: ["title", "pattern"],
              },
            },
            warnings: { type: "array", items: { type: "string" } },
          },
          required: ["realRpm", "rpmSource", "honestAssessment", "months", "revenueStreams", "warnings"],
        },
      },
    }],
    { type: "function", function: { name: "generate_revenue_projection" } }
  );
};

// ── Module: Brand Kit ────────────────────────────────────────────────
const handleBrandKit = async (niche: string) => {
  const realData = await fetchRealData(niche);
  const topChannelNames = realData.channels.slice(0, 10).map((c: any) => c.channel_name);
  
  return callAI(
    [
      { role: "system", content: "You are a YouTube branding expert. Generate channel names, color palettes, and visual prompts. Respond in Portuguese." },
      { role: "user", content: `Create a brand kit for the niche: "${niche}". 
      
REFERENCE: Top channels in this niche: ${topChannelNames.join(', ')}
      
Generate 3 channel name options that are DIFFERENT from existing channels but inspired by what works. Include tagline, reasoning, and Midjourney prompts for logo, banner, thumbnail. Plus 5-color palettes for each.` },
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
  const realData = await fetchRealData(niche);
  const viralPatterns = realData.viralTitles.slice(0, 10).map((t: any) => `"${t.title}" (${t.views} views, triggers: ${(t.emotional_triggers || []).join(', ')})`);

  return callAI(
    [
      { role: "system", content: "You are a YouTube thumbnail psychology expert who has tested 50,000+ thumbnails. Respond in Portuguese." },
      { role: "user", content: `Generate 4 high-CTR thumbnail concepts for the niche "${niche}". 

REAL VIRAL DATA - These titles went viral in this niche:
${viralPatterns.join('\n')}

Base your concepts on PROVEN patterns from these viral videos. Each concept needs: title, visual description, Midjourney/DALL-E prompt, estimated CTR score (1-10), and psychology tip explaining WHY it works based on the real data.` },
    ],
    [{
      type: "function",
      function: {
        name: "generate_thumbnails",
        description: "Generate thumbnail concepts with CTR scores based on real viral data",
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
                  psychologyTip: { type: "string" }, inspiredBy: { type: "string" },
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
const handleGrowthChecklist = async (stage: string, channelData?: any) => {
  const stageLabel = stage === "0" ? "0 subscribers (brand new)" : stage === "1000" ? "~1,000 subscribers" : stage === "10000" ? "~10,000 subscribers" : "100,000+ subscribers";
  
  const channelContext = channelData 
    ? `\n\nDADOS REAIS DO CANAL DO USUÁRIO:\n- Nome: ${channelData.channel_name}\n- Subs: ${channelData.subscribers}\n- Views: ${channelData.views}\n- Vídeos: ${channelData.videos}\n- Nicho: ${channelData.niche}\n\nPersonalize o checklist para ESTE canal específico.`
    : '';
  
  return callAI(
    [
      { role: "system", content: "You are a YouTube growth strategist who has monetized 25,000+ channels. Create actionable checklists adapted to the channel stage. Respond in Portuguese." },
      { role: "user", content: `Generate a growth checklist of 10-15 items for a channel at stage: ${stageLabel}.${channelContext}\n\nEach item needs a unique id (slug), title, description, priority (alta/média/baixa), and optionally a relevant platform module name.` },
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
  const realData = await fetchRealData(niche);
  
  const viralContext = realData.viralTitles.slice(0, 15).map((t: any) => 
    `"${t.title}" - ${t.views} views - Pattern: ${t.title_pattern || 'unknown'} - Triggers: ${(t.emotional_triggers || []).join(', ')}`
  ).join('\n');
  
  const channelContext = realData.channels.slice(0, 10).map((c: any) =>
    `${c.channel_name}: ${c.subscribers} subs, ${c.avg_views} avg views, uploads ${c.upload_frequency || 'unknown'}, style: ${c.style}`
  ).join('\n');

  return callAI(
    [
      { role: "system", content: "You are a YouTube content strategist. Base ALL recommendations on the REAL viral data provided. Respond in Portuguese." },
      { role: "user", content: `For the niche "${niche}", generate a content matrix.

REAL VIRAL TITLES IN THIS NICHE:
${viralContext || 'Nenhum dado viral disponível para este nicho'}

REAL CHANNELS IN THIS NICHE:
${channelContext || 'Nenhum canal analisado neste nicho'}

Based on this REAL data:
1) Format distribution (long-form, shorts, community posts) with percentages — based on what actually works for top channels
2) 7 weekly content suggestions INSPIRED by the proven viral patterns above
3) Strategy tip based on what the real data shows` },
    ],
    [{
      type: "function",
      function: {
        name: "generate_content_matrix",
        description: "Generate content matrix based on real viral data",
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
                properties: { 
                  day: { type: "string" }, title: { type: "string" }, format: { type: "string" }, 
                  duration: { type: "string" }, inspiredBy: { type: "string" } 
                },
                required: ["day", "title", "format", "duration"],
              },
            },
            strategyTip: { type: "string" },
            dataInsight: { type: "string", description: "Key insight from the real viral data analysis" },
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

    const { module, niche, stage, country, uploadsPerWeek, avgViews, channelData } = await req.json();

    let result: any;

    switch (module) {
      case "revenue-simulator":
        result = await handleRevenueSimulator(niche || "geral", country || "BR", uploadsPerWeek || 3, avgViews || 5000, channelData);
        break;
      case "brand-kit":
        result = await handleBrandKit(niche || "geral");
        break;
      case "thumbnail-lab":
        result = await handleThumbnailLab(niche || "geral");
        break;
      case "growth-checklist":
        result = await handleGrowthChecklist(stage || "0", channelData);
        break;
      case "content-matrix":
        result = await handleContentMatrix(niche || "geral");
        break;
      default:
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
