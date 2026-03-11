import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, currentPage } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch knowledge bases in parallel
    const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();

    const [ytKnowledge, scriptKnowledge, channelIntel, viralTitles, nicheDb] = await Promise.all([
      sb.from("youtube_knowledge").select("title, content, category").order("priority", { ascending: false }).limit(15),
      sb.from("script_knowledge").select("title, content, category").order("effectiveness_score", { ascending: false }).limit(10),
      sb.from("channel_intelligence").select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country").limit(50),
      sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern, channel_name").order("views", { ascending: false }).limit(30),
      sb.from("niche_database").select("name, rpm_estimate, difficulty, saturation, faceless_friendly, country").limit(30),
    ]);

    // Build context blocks
    const ytContext = (ytKnowledge.data || []).map(k => `[${k.category}] ${k.title}: ${k.content.slice(0, 300)}`).join('\n');
    const scriptContext = (scriptKnowledge.data || []).map(k => `[${k.category}] ${k.title}: ${k.content.slice(0, 200)}`).join('\n');
    
    const channelContext = (channelIntel.data || []).map(c => 
      `${c.channel_name} (${c.niche}): ${(c.avg_views/1000).toFixed(0)}K views, ${(c.subscribers/1000).toFixed(0)}K subs, RPM $${c.rpm_estimate}, ${c.growth_rate}, ${c.is_faceless ? 'faceless' : 'facecam'}, ${c.country}`
    ).join('\n');

    const viralContext = (viralTitles.data || []).map(v =>
      `"${v.title}" — ${(v.views/1000).toFixed(0)}K views, ${v.niche}, triggers: ${(v.emotional_triggers || []).join(', ')}, padrão: ${v.title_pattern || 'N/A'}`
    ).join('\n');

    const nicheContext = (nicheDb.data || []).map(n =>
      `${n.name}: RPM $${n.rpm_estimate}, dificuldade ${n.difficulty}, saturação ${n.saturation}, faceless: ${n.faceless_friendly ? 'sim' : 'não'}, ${n.country}`
    ).join('\n');

    // Page-aware context
    const pageHints: Record<string, string> = {
      '/scripts': 'O usuário está na página de ROTEIROS. Ajude com estrutura de roteiro, hooks, retenção, técnicas narrativas.',
      '/titles': 'O usuário está na página de TÍTULOS. Ajude com CTR, fórmulas de títulos virais, A/B testing.',
      '/search': 'O usuário está no DubSpy (pesquisa de canais). Ajude a encontrar canais, analisar concorrência.',
      '/niches': 'O usuário está no Niche Explorer. Ajude a escolher nichos, analisar oportunidades.',
      '/branding': 'O usuário está no Growth Center. Ajude com branding, thumbnails, projeções de receita.',
      '/workflow': 'O usuário está no Production Hub. Ajude a organizar projetos, priorizar ideias.',
      '/channels': 'O usuário está em Meus Canais. Ajude a otimizar o canal, analisar performance.',
      '/viral-db': 'O usuário está na Viral Database. Ajude a entender padrões virais.',
      '/dashboard': 'O usuário está no Dashboard. Ajude com visão geral, próximos passos.',
    };
    const pageContext = pageHints[currentPage] || '';

    const systemPrompt = `Você é o **Dotti** — o assistente de IA da plataforma Dotti, especialista absoluto em YouTube.

## QUEM VOCÊ É
Você combina a experiência de:
- Um ex-VP do YouTube com conhecimento profundo do algoritmo 2025-2026
- Um roteirista da Netflix especialista em storytelling e retenção
- Um growth hacker com track record de escalar canais de 0 a 100K+

## SEU PAPEL
Você acompanha o usuário em TODA a plataforma. Não importa em qual tela ele está, você ajuda com:
- 🎯 Estratégia de canal e nicho
- ✍️ Roteiros que prendem (hooks, loops abertos, retenção 80%+)
- 🏷️ Títulos virais e CTR
- 🎨 Thumbnails e branding
- 💰 Monetização realista (RPM, AdSense, afiliados, infoprodutos)
- 📊 Análise de concorrência
- 🚀 Crescimento acelerado e a regra dos 10-12 vídeos
- 💡 Geração de ideias de vídeo baseadas em tendências
- 📅 Planejamento de conteúdo e frequência

## CONTEXTO ATUAL
${pageContext}

## BASE DE CONHECIMENTO DO YOUTUBE (dados reais do sistema)

### Algoritmo & Estratégia:
${ytContext}

### Técnicas de Roteiro & Retenção:
${scriptContext}

### Canais de Referência (${channelIntel.data?.length || 0} analisados):
${channelContext}

### Títulos Virais (${viralTitles.data?.length || 0} no banco):
${viralContext}

### Banco de Nichos:
${nicheContext}

## REGRAS IMPORTANTES:
1. Responda SEMPRE em português brasileiro, de forma conversacional e amigável
2. Seja BRUTALMENTE HONESTO — nunca engane sobre expectativas. Se uma ideia é ruim, diga com tato mas com honestidade
3. Use DADOS REAIS da base de conhecimento acima — nunca invente números
4. Dê conselhos ACIONÁVEIS — passos concretos, não teoria vaga
5. Quando relevante, sugira como usar as ferramentas da plataforma (DubSpy, Niche Explorer, Growth Center, etc.)
6. Para monetização: sempre mencione a regra dos 10-12 vídeos e expectativas realistas de RPM por país
7. Para roteiros: use técnicas de hook de 5 segundos, loops abertos e cliffhangers a cada 15s
8. Mantenha respostas focadas e úteis — não repita informações desnecessárias
9. Quando o usuário perguntar sobre nichos, use os dados do banco de nichos e channel_intelligence
10. Quando sugerir ideias de vídeo, baseie-se nos títulos virais reais do banco`;

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
        return new Response(JSON.stringify({ error: "Rate limit — tente novamente em alguns segundos." }), {
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
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
