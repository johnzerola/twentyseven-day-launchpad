import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, currentPage, mode, onboardingData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch knowledge bases in parallel
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
      '/scripts': 'O usuário está na página de ROTEIROS.',
      '/titles': 'O usuário está na página de TÍTULOS.',
      '/search': 'O usuário está no DubSpy (pesquisa de canais).',
      '/niches': 'O usuário está no Niche Explorer.',
      '/branding': 'O usuário está no Growth Center.',
      '/workflow': 'O usuário está no Production Hub.',
      '/channels': 'O usuário está em Meus Canais.',
      '/viral-db': 'O usuário está na Viral Database.',
      '/dashboard': 'O usuário está no Dashboard.',
      '/multichannel': 'O usuário está no Multichannel Manager.',
    };
    const pageContext = pageHints[currentPage] || '';

    // ========== ONBOARDING MODE ==========
    if (mode === 'onboarding' && onboardingData) {
      const od = onboardingData;
      const onboardingPrompt = `Você é o **Dotti** — assistente de onboarding da plataforma.

## MISSÃO
Gere um PLANO PERSONALIZADO DE 30 DIAS para o usuário baseado nos dados abaixo.

## DADOS DO USUÁRIO
- Tem canal: ${od.hasChannel ? 'Sim' : 'Não'}
${od.channelLink ? `- Canal: ${od.channelLink}` : ''}
${od.hoursPerDay ? `- Horas disponíveis/dia: ${od.hoursPerDay}` : ''}
${od.languages ? `- Idiomas: ${od.languages}` : ''}
${od.niche ? `- Nicho de interesse: ${od.niche}` : ''}
${od.budget ? `- Orçamento: ${od.budget === 'low' ? 'Baixo (~$0)' : od.budget === 'medium' ? 'Médio (~$50-100/mês)' : 'Alto ($200+/mês)'}` : ''}
${od.preference ? `- Preferência: ${od.preference === 'passion' ? 'Fazer o que ama' : od.preference === 'money' ? 'Priorizar monetização' : 'Unir paixão e monetização'}` : ''}

## BASE DE DADOS REAL

### Nichos disponíveis com dados:
${nicheContext}

### Canais de referência (${channelIntel.data?.length || 0}):
${channelContext.slice(0, 3000)}

### Algoritmo YouTube:
${ytContext.slice(0, 2000)}

## FORMATO DO PLANO (OBRIGATÓRIO)

### 🎯 Diagnóstico Inicial
- Análise honesta da situação do usuário
- Nicho recomendado (com justificativa baseada em RPM e saturação)
${od.preference === 'both' ? '- Sugestão de como unir paixão com monetização neste nicho' : ''}

### 📅 Semana 1 (Dias 1-7): Setup
- Dia a dia com tarefas específicas e executáveis
- Criação de canal, identidade visual, primeiros roteiros

### 📅 Semana 2 (Dias 8-14): Primeiros Vídeos
- Schedule de upload (baseado nas horas disponíveis)
- Foco em SEO e títulos virais

### 📅 Semana 3 (Dias 15-21): Otimização
- Análise de métricas, ajustes de thumbnail e títulos
- Estudar concorrentes no DubSpy

### 📅 Semana 4 (Dias 22-30): Escala & Monetização
- Estratégias de crescimento acelerado
- Ativação de monetização (AdSense, afiliados, infoprodutos)

### 💰 Projeção Financeira
- Estimativa realista de views e receita ao final de 30 dias
- RPM esperado baseado no nicho e país
- Metas de inscritos realistas

### 🛠️ Ferramentas da Plataforma Para Usar
- Quais ferramentas usar em cada etapa (DubSpy, Niche Explorer, Roteiros, etc.)

## REGRAS:
1. Seja BRUTALMENTE HONESTO sobre expectativas
2. Use DADOS REAIS da base de nichos
3. Adapte o plano às horas disponíveis (não sugira 3 vídeos/dia para quem tem 1h)
4. Se o orçamento é baixo, foque em estratégias gratuitas
5. Responda em português brasileiro
6. Use emojis para organizar visualmente
7. Cada dia deve ter UMA tarefa principal clara`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: onboardingPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI error");
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ========== REGULAR CHAT MODE ==========
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

## FUNCIONALIDADES DA PLATAFORMA (sugira quando relevante):
- **DubSpy** (/search): Encontrar canais emergentes e concorrentes com viral score
- **Niche Explorer** (/niches): Analisar nichos com RPM, saturação e projeções financeiras
- **Roteiros** (/scripts): Gerar roteiros com pipeline Ensemble AI (GPT-5 + Gemini + fact-check)
- **Títulos Virais** (/titles): Gerar e comparar títulos A/B com CTR estimado
- **Growth Center** (/branding): Branding, nomes de canal e identidade visual
- **Viral Database** (/viral-db): 900+ títulos virais reais com padrões e gatilhos
- **Workflow** (/workflow): Kanban para organizar projetos
- **Multichannel** (/multichannel): Gerenciar 50+ canais com rollouts em escala
- **Meus Canais** (/channels): Vincular, analisar e acompanhar canais

## FOLLOW-UP SEMANAL
Se o usuário mencionar que está na segunda semana ou mais, ofereça:
- "Quer enviar suas métricas para eu avaliar o progresso?"
- "Quer conectar seu canal para análise automática?"
- Sugira ajustes no plano baseado nos resultados

## REGRAS IMPORTANTES:
1. Responda SEMPRE em português brasileiro, conversacional e amigável
2. Seja BRUTALMENTE HONESTO — nunca engane sobre expectativas
3. Use DADOS REAIS da base de conhecimento — nunca invente números
4. Dê conselhos ACIONÁVEIS — passos concretos, não teoria vaga
5. Sugira ferramentas da plataforma quando relevante
6. Para monetização: mencione a regra dos 10-12 vídeos e RPM por país
7. Mantenha respostas focadas e úteis
8. Se o usuário perguntar sobre nichos, use dados do banco real
9. Se sugerir ideias de vídeo, baseie nos títulos virais reais`;

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
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
