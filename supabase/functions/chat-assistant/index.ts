import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchNicheRecommendations(country?: string, language?: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch all channels, we'll process in memory
  const { data: channels, error } = await sb
    .from("channel_intelligence")
    .select("niche, country, language, rpm_estimate, avg_views, subscribers, growth_rate, is_faceless, style, sub_niche")
    .limit(1000);

  if (error || !channels?.length) return "";

  // Score niches: group by niche, calculate avg RPM, avg views, count, growth
  const growthMultiplier: Record<string, number> = { explosive: 3, fast: 2, steady: 1, slow: 0.5 };
  const nicheMap = new Map<string, { rpm: number[]; views: number[]; growth: number[]; countries: Set<string>; langs: Set<string>; facelessCount: number; total: number; styles: Set<string>; subNiches: Set<string> }>();

  for (const ch of channels) {
    const key = ch.niche;
    if (!nicheMap.has(key)) {
      nicheMap.set(key, { rpm: [], views: [], growth: [], countries: new Set(), langs: new Set(), facelessCount: 0, total: 0, styles: new Set(), subNiches: new Set() });
    }
    const n = nicheMap.get(key)!;
    n.rpm.push(Number(ch.rpm_estimate) || 0);
    n.views.push(Number(ch.avg_views) || 0);
    n.growth.push(growthMultiplier[ch.growth_rate] ?? 1);
    n.countries.add(ch.country);
    n.langs.add(ch.language);
    if (ch.is_faceless) n.facelessCount++;
    n.total++;
    if (ch.style) n.styles.add(ch.style);
    if (ch.sub_niche) n.subNiches.add(ch.sub_niche);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  // Score each niche
  let scored = Array.from(nicheMap.entries()).map(([niche, d]) => {
    const avgRpm = avg(d.rpm);
    const avgViews = avg(d.views);
    const avgGrowth = avg(d.growth);
    const facelessRatio = d.facelessCount / d.total;

    // Boost if matches user country/language
    let countryBoost = 1;
    let langBoost = 1;
    if (country && d.countries.has(country)) countryBoost = 1.5;
    if (language && d.langs.has(language)) langBoost = 1.3;

    const score = (avgRpm * 2 + avgGrowth * 50 + Math.log10(avgViews + 1) * 10) * countryBoost * langBoost;

    return {
      niche,
      score,
      avgRpm: avgRpm.toFixed(2),
      avgViews: Math.round(avgViews),
      avgGrowth: avgGrowth > 2 ? "Explosive" : avgGrowth > 1.5 ? "Fast" : "Steady",
      facelessRatio: Math.round(facelessRatio * 100),
      channels: d.total,
      countries: Array.from(d.countries).slice(0, 5),
      styles: Array.from(d.styles).slice(0, 3),
      subNiches: Array.from(d.subNiches).slice(0, 5),
    };
  });

  // Sort by score, top 10
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 10);

  return `\n\n--- DADOS REAIS DA BASE DE INTELIGÊNCIA (${channels.length} canais analisados) ---
TOP 10 NICHOS${country ? ` para ${country}` : ''}${language ? ` em ${language}` : ''}:
${top.map((n, i) => `${i + 1}. **${n.niche}** — RPM médio: $${n.avgRpm} | Views médias: ${n.avgViews.toLocaleString()} | Crescimento: ${n.avgGrowth} | Faceless: ${n.facelessRatio}% | ${n.channels} canais | Países: ${n.countries.join(', ')} | Estilos: ${n.styles.join(', ')} | Sub-nichos: ${n.subNiches.join(', ')}`).join('\n')}
---`;
}

function detectCountryLanguage(messages: Array<{ role: string; content: string }>): { country?: string; language?: string } {
  const text = messages.map(m => m.content).join(' ').toLowerCase();

  const countryMap: Record<string, string> = {
    'brasil': 'BR', 'brazil': 'BR', 'eua': 'US', 'usa': 'US', 'estados unidos': 'US', 'united states': 'US',
    'alemanha': 'DE', 'germany': 'DE', 'frança': 'FR', 'france': 'FR', 'polônia': 'PL', 'poland': 'PL', 'polonia': 'PL',
    'japão': 'JP', 'japan': 'JP', 'coreia': 'KR', 'korea': 'KR', 'turquia': 'TR', 'turkey': 'TR',
    'portugal': 'PT', 'espanha': 'ES', 'spain': 'ES', 'itália': 'IT', 'italy': 'IT', 'méxico': 'MX', 'mexico': 'MX',
    'canadá': 'CA', 'canada': 'CA', 'austrália': 'AU', 'australia': 'AU', 'reino unido': 'GB', 'uk': 'GB',
    'holanda': 'NL', 'netherlands': 'NL', 'países baixos': 'NL', 'suíça': 'CH', 'switzerland': 'CH',
    'noruega': 'NO', 'norway': 'NO', 'suécia': 'SE', 'sweden': 'SE', 'dinamarca': 'DK', 'denmark': 'DK',
    'irlanda': 'IE', 'ireland': 'IE', 'argentina': 'AR', 'chile': 'CL', 'colômbia': 'CO', 'colombia': 'CO',
    'filipinas': 'PH', 'philippines': 'PH', 'indonésia': 'ID', 'indonesia': 'ID', 'singapura': 'SG', 'singapore': 'SG',
    'nova zelândia': 'NZ', 'new zealand': 'NZ', 'bélgica': 'BE', 'belgium': 'BE', 'áustria': 'AT', 'austria': 'AT',
    'áfrica do sul': 'ZA', 'south africa': 'ZA',
  };

  const langMap: Record<string, string> = {
    'português': 'pt', 'portugues': 'pt', 'portuguese': 'pt', 'inglês': 'en', 'english': 'en', 'ingles': 'en',
    'alemão': 'de', 'german': 'de', 'francês': 'fr', 'french': 'fr', 'frances': 'fr',
    'polonês': 'pl', 'polish': 'pl', 'japones': 'ja', 'japonês': 'ja', 'japanese': 'ja',
    'coreano': 'ko', 'korean': 'ko', 'turco': 'tr', 'turkish': 'tr', 'espanhol': 'es', 'spanish': 'es',
    'italiano': 'it', 'italian': 'it', 'holandês': 'nl', 'dutch': 'nl', 'holandes': 'nl',
    'norueguês': 'no', 'norwegian': 'no', 'sueco': 'sv', 'swedish': 'sv', 'dinamarquês': 'da', 'danish': 'da',
  };

  let country: string | undefined;
  let language: string | undefined;

  for (const [keyword, code] of Object.entries(countryMap)) {
    if (text.includes(keyword)) { country = code; break; }
  }
  for (const [keyword, code] of Object.entries(langMap)) {
    if (text.includes(keyword)) { language = code; break; }
  }

  return { country, language };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Detect if user is asking about niches/recommendations
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const isNicheQuery = /nicho|niche|recomend|suggest|melhor|best|lucrat|rentáv|rentav|rpm|monetiz|qual.*criar|what.*create|começar|comecar|start/i.test(lastMsg);

    let nicheData = '';
    if (isNicheQuery) {
      const { country, language } = detectCountryLanguage(messages);
      nicheData = await fetchNicheRecommendations(country, language);
    }

    const systemPrompt = `Você é um especialista em YouTube com 10+ anos de experiência no algoritmo (2025-2026). 
Responda em português de forma clara e prática sobre:
- Retenção de audiência e técnicas de hook
- CTR (Click-Through Rate) e otimização de thumbnails/títulos
- SEO para YouTube (tags, descrição, palavras-chave)
- Monetização (RPM, CPM, AdSense, patrocínios)
- Algoritmo do YouTube (recomendação, shorts, long-form)
- Estratégias de crescimento rápido e nichos lucrativos
- Frequência de upload e melhores horários
Seja direto, use dados quando possível, e dê conselhos acionáveis.

IMPORTANTE: Quando o usuário perguntar sobre nichos, recomendações ou qual canal criar, SEMPRE:
1. Pergunte o país e idioma do canal se ainda não souber
2. Use os dados reais da base de inteligência abaixo para recomendar os TOP 5 nichos personalizados
3. Para cada nicho recomendado, inclua: RPM estimado, views médias, taxa de crescimento, % faceless, sub-nichos e estilos visuais
4. Explique POR QUE cada nicho é bom para o país/idioma específico do usuário
5. Sugira um plano de ação rápido (3 passos) para o nicho #1
${nicheData}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});