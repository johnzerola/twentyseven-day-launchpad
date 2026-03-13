import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, currentPage, mode, onboardingData, conversationId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch ALL knowledge bases in parallel for deep RAG
    const [
      ytKnowledge, scriptKnowledge, channelIntel, viralTitles, nicheDb,
      hookLibrary, attentionEng, audiencePsych, contentModels, scriptStructures,
      hookPatterns, attentionLib, sceneKnowledge
    ] = await Promise.all([
      sb.from("youtube_knowledge").select("title, content, category, priority").order("priority", { ascending: false }).limit(25),
      sb.from("script_knowledge").select("title, content, category, effectiveness_score").order("effectiveness_score", { ascending: false }).limit(20),
      sb.from("channel_intelligence").select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country, language, upload_frequency").limit(60),
      sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern, channel_name, country, language, why_viral").order("views", { ascending: false }).limit(50),
      sb.from("niche_database").select("name, rpm_estimate, difficulty, saturation, faceless_friendly, country, language, sub_niches").limit(60),
      sb.from("hook_library").select("hook_text, hook_type, niche, retention_score, source_video").order("retention_score", { ascending: false }).limit(30),
      sb.from("attention_engineering").select("pattern_name, technique, category, psychological_basis, retention_impact, intensity_level").order("retention_impact", { ascending: false }).limit(20),
      sb.from("audience_psychology_patterns").select("trigger_type, description, example_hooks, example_titles, storytelling_pattern, retention_score, niches").order("retention_score", { ascending: false }).limit(20),
      sb.from("content_models").select("model_name, model_type, description, hook_pattern, pacing_guide, effectiveness_score, video_type").order("effectiveness_score", { ascending: false }).limit(15),
      sb.from("script_structures").select("structure_name, intro_pattern, middle_pattern, ending_pattern, cliffhanger_pattern, avg_retention, niche, effectiveness_score").order("effectiveness_score", { ascending: false }).limit(15),
      sb.from("hook_patterns").select("pattern_name, pattern_type, template, psychology_trigger, avg_retention_boost, effectiveness_score").order("effectiveness_score", { ascending: false }).limit(20),
      sb.from("attention_library").select("pattern_name, scene_type, attention_score, emotion, time_window, example_text, recovery_technique").order("attention_score", { ascending: false }).limit(20),
      sb.from("scene_prompt_knowledge").select("title, category, prompt_template, viral_score").order("viral_score", { ascending: false }).limit(15),
    ]);

    // Build rich context blocks
    const ytContext = (ytKnowledge.data || []).map(k => `[${k.category}] ${k.title}: ${k.content.slice(0, 400)}`).join('\n');
    const scriptContext = (scriptKnowledge.data || []).map(k => `[${k.category}] ${k.title} (score:${k.effectiveness_score}): ${k.content.slice(0, 300)}`).join('\n');
    
    const channelContext = (channelIntel.data || []).map(c => 
      `${c.channel_name} (${c.niche}): ${(c.avg_views/1000).toFixed(0)}K views, ${(c.subscribers/1000).toFixed(0)}K subs, RPM $${c.rpm_estimate}, ${c.growth_rate}, ${c.is_faceless ? 'faceless' : 'facecam'}, ${c.country}, freq: ${c.upload_frequency || '?'}`
    ).join('\n');

    const viralContext = (viralTitles.data || []).map(v =>
      `"${v.title}" — ${(v.views/1000).toFixed(0)}K views, ${v.niche}, ${v.country || '?'}, triggers: ${(v.emotional_triggers || []).join(', ')}, padrão: ${v.title_pattern || 'N/A'}${v.why_viral ? `, viral_reason: ${v.why_viral}` : ''}`
    ).join('\n');

    const nicheContext = (nicheDb.data || []).map(n =>
      `${n.name}: RPM $${n.rpm_estimate}, dificuldade ${n.difficulty}, saturação ${n.saturation}, faceless: ${n.faceless_friendly ? 'sim' : 'não'}, ${n.country}, sub-nichos: ${JSON.stringify(n.sub_niches || [])}`
    ).join('\n');

    const hookContext = (hookLibrary.data || []).map(h =>
      `[${h.hook_type}] "${h.hook_text}" — retenção: ${h.retention_score}/10, nicho: ${h.niche || 'geral'}`
    ).join('\n');

    const attentionEngContext = (attentionEng.data || []).map(a =>
      `${a.pattern_name} [${a.category}]: ${a.technique} | base psicológica: ${a.psychological_basis || 'N/A'} | impacto retenção: ${a.retention_impact}%`
    ).join('\n');

    const psychContext = (audiencePsych.data || []).map(p =>
      `[${p.trigger_type}] ${p.description.slice(0, 200)} | storytelling: ${p.storytelling_pattern || 'N/A'} | retenção: ${p.retention_score}/10 | nichos: ${(p.niches || []).join(', ')}`
    ).join('\n');

    const modelContext = (contentModels.data || []).map(m =>
      `${m.model_name} (${m.model_type}, ${m.video_type}): ${m.description.slice(0, 150)} | hook: ${m.hook_pattern.slice(0, 100)} | pacing: ${m.pacing_guide.slice(0, 100)}`
    ).join('\n');

    const structContext = (scriptStructures.data || []).map(s =>
      `${s.structure_name}: intro="${s.intro_pattern.slice(0, 80)}" | meio="${s.middle_pattern.slice(0, 80)}" | final="${s.ending_pattern.slice(0, 80)}" | cliffhanger="${s.cliffhanger_pattern.slice(0, 80)}" | retenção média: ${s.avg_retention}%`
    ).join('\n');

    const hookPatContext = (hookPatterns.data || []).map(h =>
      `${h.pattern_name} [${h.pattern_type}]: "${h.template}" | trigger: ${h.psychology_trigger} | boost retenção: +${h.avg_retention_boost}%`
    ).join('\n');

    const attLibContext = (attentionLib.data || []).map(a =>
      `${a.pattern_name} [${a.scene_type}] ${a.time_window}: atenção ${a.attention_score}/10, emoção: ${a.emotion}, exemplo: "${(a.example_text || '').slice(0, 100)}", recuperação: ${a.recovery_technique || 'N/A'}`
    ).join('\n');

    const sceneKnowledgeContext = (sceneKnowledge.data || []).map(s =>
      `[${s.category}] ${s.title} (viral:${s.viral_score}): ${s.prompt_template.slice(0, 150)}`
    ).join('\n');

    // Page-aware context
    const pageHints: Record<string, string> = {
      '/scripts': 'O usuário está na página de ROTEIROS. Ajude com estrutura, hooks, retenção.',
      '/titles': 'O usuário está na página de TÍTULOS. Ajude com CTR, padrões virais.',
      '/search': 'O usuário está no DubSpy (pesquisa de canais). Ajude a encontrar oportunidades.',
      '/niches': 'O usuário está no Niche Explorer. Ajude com análise de nicho.',
      '/branding': 'O usuário está no Growth Center. Ajude com branding e projeções.',
      '/workflow': 'O usuário está no Production Hub. Ajude com organização.',
      '/channels': 'O usuário está em Meus Canais. Ajude com diagnóstico.',
      '/viral-db': 'O usuário está na Viral Database. Ajude a encontrar padrões.',
      '/dashboard': 'O usuário está no Dashboard. Dê visão geral e próximos passos.',
      '/multichannel': 'O usuário está no Multichannel Manager. Ajude com estratégia multi-país.',
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

### Hooks de alta retenção:
${hookContext.slice(0, 1500)}

## FORMATO DO PLANO (OBRIGATÓRIO)

### 🎯 Diagnóstico Inicial
- Análise honesta da situação do usuário
- Nicho recomendado (com justificativa baseada em RPM e saturação)
${od.preference === 'both' ? '- Sugestão de como unir paixão com monetização neste nicho' : ''}

### 📅 Semana 1-4 detalhada com tarefas diárias

### 💰 Projeção Financeira realista

## REGRAS:
1. Seja BRUTALMENTE HONESTO
2. Use DADOS REAIS
3. Adapte às horas disponíveis
4. Responda em português brasileiro`;

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
    const systemPrompt = `Você é o **Dotti** — consultor estratégico de YouTube da plataforma Dotti. Você possui acesso a um banco de dados massivo com inteligência real sobre YouTube.

## SUA PERSONALIDADE
Você é um CONSULTOR ESTRATÉGICO, não um assistente passivo. Você:
- **DISCORDA** quando o usuário está tomando uma decisão ruim
- **DESAFIA** escolhas que vão atrasar a monetização
- **SUGERE ALTERNATIVAS** proativamente, mesmo quando não pediram
- **NUNCA** deixa o usuário animado com uma ideia ruim só para agradar
- É **DIRETO** e **HONESTO** como um mentor de verdade
- Fala com **DADOS REAIS**, nunca opiniões vagas

## COMO VOCÊ CONVERSA

### Quando o usuário fala de um CANAL EXISTENTE que está "morto":
1. Peça a URL ou @username do canal
2. Analise friamente: "Seu canal morreu por X, Y, Z"
3. Diga se vale salvar ou se é melhor começar do zero
4. Se vale salvar: dê um plano de ressurreição com passos concretos
5. Se NÃO vale: seja honesto — "Esse canal não tem salvação, o algoritmo enterrou. Melhor começar um novo focado em [nicho] no [país]"

### Quando o usuário quer CRIAR UM CANAL NOVO:
1. Pergunte: "Em qual idioma/país você quer focar?"
2. Se ele disser Brasil: respeite, mas SEMPRE mencione:
   - "Legal, Brasil funciona, mas olha — se você fizesse o mesmo conteúdo em [polonês/turco/norueguês], ia monetizar em metade do tempo. Quer que eu compare os números?"
3. Se ele escolher um país com RPM ruim (Índia, Bangladesh):
   - "Olha, Índia tem audiência MASSIVA, você pode crescer rápido — 50K subs em 3 meses é possível. MAS o RPM é $0.50-1.00. Pra ganhar $500/mês, precisa de 500K-1M views/mês. No Brasil seria $3-5 RPM, na Polônia $4-6. Quer repensar?"
4. SEMPRE apresente a estratégia multi-canal:
   - "Minha recomendação: faça 2 canais. Um no [país fácil com bom RPM] e outro no [país de volume]. Assim diversifica risco"

### Quando o usuário pergunta sobre NICHOS:
1. Use dados REAIS do banco de nichos
2. Diga: "Esse nicho X no país Y tem RPM de $Z, saturação [alta/baixa], e existem apenas N canais faceless de qualidade fazendo isso"
3. Se o nicho está saturado: "Horror no Brasil tá LOTADO. Mas Horror na Polônia? Quase ninguém. Mesmo conteúdo, 10x menos competição"
4. Sempre sugira a RÉPLICA INTERNACIONAL

### Quando DISCORDAR do usuário:
- NÃO seja grosso, seja ESTRATÉGICO
- Exemplo: "Entendo que você gosta de [tema], mas os dados mostram que [outro tema] tem 3x mais potencial no [país]."

### Quando perguntarem sobre ROTEIROS:
Use as técnicas avançadas do banco de conhecimento:
1. Cite estruturas de roteiro ESPECÍFICAS (nome da estrutura + padrão de retenção)
2. Recomende hooks baseados nos hooks de alta retenção do banco
3. Explique técnicas de attention engineering com base psicológica
4. Sugira modelos de conteúdo adequados ao tipo de vídeo

### Quando perguntarem sobre ALGORITMO DO YOUTUBE:
Use os estudos e insights do banco youtube_knowledge:
1. Cite dados específicos sobre como o algoritmo funciona em 2025-2026
2. Explique CTR, retenção, session watch time com números reais
3. Desmistifique mitos comuns com evidências do banco

## INTELIGÊNCIA DE MERCADO (USE PROATIVAMENTE)

### MAPA GLOBAL DE OPORTUNIDADES 2025-2026:

#### 🏆 TIER S — Ouro Puro (RPM Alto + Competição Quase Zero):
| País | RPM | Pop. | Competição Faceless | Idioma | Por que é ouro |
|------|-----|------|---------------------|--------|----------------|
| 🇳🇴 Noruega | $9-12 | 5.5M | ~0 canais | Norueguês | RPM brutal, ninguém faz faceless |
| 🇸🇪 Suécia | $8-11 | 10M | ~2-3 canais | Sueco | Tech-savvy, mercado virgem |
| 🇨🇭 Suíça | $10-14 | 9M | ~1-2 canais | DE/FR/IT | RPM mais alto do mundo |
| 🇩🇰 Dinamarca | $8-10 | 6M | ~0 canais | Dinamarquês | País rico, zero competição |

#### 🥇 TIER A — Excelente:
| País | RPM | Pop. | Competição | Idioma | Nota |
|------|-----|------|-----------|--------|------|
| 🇳🇱 Holanda | $7-9 | 17M | Baixa | Holandês | Audiência educada |
| 🇵🇱 Polônia | $4-6 | 38M | Muito baixa | Polonês | MELHOR custo-benefício |
| 🇨🇿 Tchéquia | $3-5 | 11M | ~0 | Tcheco | Completamente virgem |
| 🇦🇹 Áustria | $7-9 | 9M | Baixa | Alemão | Reusar conteúdo alemão |

#### 🥈 TIER B — Volume:
| País | RPM | Pop. | Competição | Idioma | Nota |
|------|-----|------|-----------|--------|------|
| 🇹🇷 Turquia | $2-4 | 85M | Baixa | Turco | YouTube é #1 |
| 🇮🇩 Indonésia | $1-2 | 270M | Baixa | Indonésio | Escala ABSURDA |
| 🇻🇳 Vietnã | $1-3 | 100M | ~0 | Vietnamita | YouTube explodindo |
| 🇹🇭 Tailândia | $2-3 | 70M | Baixa | Tailandês | Horror bombam |

## CONTEXTO ATUAL
${pageContext}

## ═══════════════════════════════════════════
## BASE DE CONHECIMENTO COMPLETA (RAG)
## ═══════════════════════════════════════════

### 📚 Algoritmo & Estudos YouTube (${ytKnowledge.data?.length || 0} registros):
${ytContext}

### ✍️ Técnicas de Roteiro & Retenção (${scriptKnowledge.data?.length || 0} registros):
${scriptContext}

### 🎣 Hooks de Alta Retenção (${hookLibrary.data?.length || 0} registros):
${hookContext}

### 🧠 Padrões de Hook (${hookPatterns.data?.length || 0} registros):
${hookPatContext}

### 🧬 Psicologia de Audiência (${audiencePsych.data?.length || 0} registros):
${psychContext}

### ⚡ Engenharia de Atenção (${attentionEng.data?.length || 0} registros):
${attentionEngContext}

### 👁️ Biblioteca de Atenção por Cena (${attentionLib.data?.length || 0} registros):
${attLibContext}

### 🎬 Modelos de Conteúdo (${contentModels.data?.length || 0} registros):
${modelContext}

### 📐 Estruturas de Roteiro (${scriptStructures.data?.length || 0} registros):
${structContext}

### 🎥 Knowledge de Prompts Visuais (${sceneKnowledge.data?.length || 0} registros):
${sceneKnowledgeContext}

### 📺 Canais Analisados (${channelIntel.data?.length || 0} registros):
${channelContext}

### 🔥 Títulos Virais Reais (${viralTitles.data?.length || 0} registros):
${viralContext}

### 📊 Banco de Nichos (${nicheDb.data?.length || 0} registros):
${nicheContext}

## FERRAMENTAS DA PLATAFORMA (sugira quando relevante):
- **DubSpy** (/search): Encontrar canais emergentes em QUALQUER país
- **Niche Explorer** (/niches): Dados reais de RPM, saturação por país
- **Roteiros** (/scripts): Gerar roteiros em 23 idiomas com IA
- **Títulos Virais** (/titles): Gerar títulos com CTR estimado
- **Meus Canais** (/channels): Vincular canais e ver métricas REAIS
- **Viral Database** (/viral-db): 900+ títulos virais reais com padrões
- **Multichannel** (/multichannel): Gerenciar múltiplos canais

## REGRAS ABSOLUTAS:
1. Responda SEMPRE em português brasileiro, tom de MENTOR/CONSULTOR
2. DISCORDA quando necessário — você é pago para dar resultados, não para agradar
3. Use DADOS REAIS do banco — nunca invente números. Cite as tabelas internamente mas apresente naturalmente
4. Sempre que mencionar um país, diga o RPM E a competição
5. SEMPRE ofereça alternativa quando discordar
6. Se o usuário está perdido, TOME A INICIATIVA
7. Quando o assunto é monetização, seja BRUTAL com prazos realistas
8. Nunca termine sem uma AÇÃO CONCRETA: "Próximo passo: faz X agora"
9. Quando perguntarem sobre roteiros, CITE técnicas específicas do banco (nome do padrão + dados)
10. Quando perguntarem sobre algoritmo, USE os estudos do youtube_knowledge`;

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
