import { callGeminiStreaming } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONETIZATION_KNOWLEDGE = `
## BASE DE CONHECIMENTO DE MONETIZAÇÃO YOUTUBE (Dados Reais 2024-2026)

### FATO CRÍTICO: A "Bolha dos 10-12 Vídeos"
- O YouTube só entende seu conteúdo após 10-12 vídeos consistentes no mesmo nicho
- Antes disso, o algoritmo está "testando" seu canal com audiências aleatórias
- A maioria dos criadores desiste antes de furar essa bolha
- Canais que mantêm consistência de nicho nos primeiros 12 vídeos têm 4x mais chance de crescer

### RPM REAL POR PAÍS (CPM médio 2025)
- 🇺🇸 EUA: $6-12 RPM (média $7.50)
- 🇧🇷 Brasil: $0.80-2.50 RPM (média $1.50)
- 🇵🇹 Portugal: $2.50-4.00 RPM (média $3.00)
- 🇲🇽 México: $0.60-1.50 RPM (média $1.00)
- 🇮🇳 Índia: $0.20-0.80 RPM (média $0.50)
- 🇩🇪 Alemanha: $4.50-7.00 RPM (média $5.50)
- 🇯🇵 Japão: $3.50-6.00 RPM (média $4.50)

### TEMPO REAL PARA MONETIZAÇÃO
- Canal consistente (3-4 vídeos/semana): 3-6 meses para 1K subs + 4K horas
- Canal moderado (2 vídeos/semana): 6-12 meses
- Canal lento (1 vídeo/semana): 12-18 meses
- Shorts SOZINHOS: Dificílimo monetizar (RPM de shorts = $0.04-0.07)

### ESTRATÉGIA DE CONTEÚDO COMPROVADA
1. **Long-form (8-15 min)**: Principal gerador de watch time e receita
2. **Shorts (30-60s)**: Teasers do vídeo longo, NUNCA conteúdo isolado
3. **Community posts**: 1-2x por semana (enquetes, memes do nicho, trending topics)
4. **Frequência ideal**: 3 vídeos longos + 3-5 shorts por semana

### FONTES DE RECEITA (ordem de implementação)
1. **Mês 0-1**: Infoprodutos de baixo custo (R$17-47) via link na descrição
2. **Mês 1-3**: Marketing de afiliados (Amazon, Hotmart, etc.)
3. **Mês 3-6**: AdSense (após atingir YPP)
4. **Mês 6+**: Patrocínios, membros, Super Chats

### COMMUNITY POSTS (Estratégia de Engajamento)
- Enquetes semanais relacionadas ao nicho (ex: "Qual tema pro próximo vídeo?")
- Aproveitar trending topics com humor do nicho
- Exemplo: Se Neymar está em alta e seu nicho é finanças: "Neymar curtindo foto no Dia das Mulheres: último romântico ou estratégia de marketing pessoal? 😂"
- Posts sérios para criar laço: compartilhar bastidores, vulnerabilidade, metas do canal
- NUNCA ignorar trends: o algoritmo da aba Community também impulsiona o canal

### SHORTS VINCULADOS AO LONG-FORM
- Cada vídeo longo deve gerar 2-3 shorts
- Short = gancho intrigante que termina com "vídeo completo no canal"
- Shorts NÃO substituem long-form, são COMPLEMENTO
- Melhor horário para shorts: 11h-13h e 18h-20h (horário local)

### MONETIZAÇÃO ALÉM DO ADSENSE (ordem de implementação real)

#### 1. AFILIADOS INTEGRADOS AO CONTEÚDO (Mês 0+, sem requisitos)
- Amazon Associates: link na descrição para produtos mencionados no vídeo
- Hotmart/Eduzz/Kiwify: infoprodutos do nicho (comissão 30-80%)
- Shopee/AliExpress: produtos virais com comissão 5-15%
- Estratégia: NUNCA fazer "review de produto" genérico — integre naturalmente ("o mic que uso é X, link abaixo")
- CPV (custo por venda) > CPM para canais pequenos
- Canais com 500 subs podem gerar R$500-2000/mês com afiliados bem posicionados

#### 2. SPONSORSHIP DIRETO (Mês 1+, a partir de 500 subs)
- Micro-sponsorships: marcas de nicho pagam $50-200 por vídeo para canais com <5K subs
- Plataformas: Collabstr, Grin, AspireIQ, ou DM direto para marcas do nicho
- Media kit: crie com Canva mostrando engajamento (não subs) — taxa de like/comentário importa mais
- Precificação: $20-50 por 1K views estimadas (canais pequenos)
- Integração nativa: 15-30s no meio do vídeo retém melhor que pre-roll

#### 3. INFOPRODUTOS PRÓPRIOS (Mês 1+)
- E-book/checklist: R$17-47, vende pelo link na descrição
- Mini-curso: R$97-197 em plataforma como Hotmart
- Templates/presets: se nicho é criativo (edição, design, produtividade)
- Comunidade paga: Discord/Telegram VIP por R$19-49/mês
- LTV > RPM: 1 venda de R$97 = RPM de ~65.000 views no Brasil

#### 4. W REWARDS (Alternativa ao YPP, sem requisitos)
- Programa alternativo: $0.50-1.00 por 1K views
- Ideal para: canais com risco de "conteúdo reutilizado", compilações, motivação
- Não conflita com AdSense — pode usar ambos após YPP

#### 5. ADSENSE/YPP (Mês 3-6+)
- Requisitos: 1K subs + 4K horas watch time OU 10M views Shorts
- RPM varia drasticamente por país e nicho
- Shorts RPM: $0.04-0.07 (muito baixo — nunca dependa só disso)

### SINAIS DE IDEIAS RUINS (ser honesto)
- Nicho ultra-saturado sem diferencial (ex: "motivação genérica")
- Conteúdo que depende 100% de facecam sem experiência
- Nichos com RPM < $0.50 esperando "ficar rico" SÓ com AdSense
- Copiar exatamente o que outros fazem sem inovação
- Expectativa de 10K subs em 30 dias (irreal para 99% dos canais)
- Ignorar afiliados/sponsorship e esperar só pelo YPP (erro mais comum)
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userContext } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const systemPrompt = `Você é o Coach de Monetização do HacksLab — um especialista REAL em YouTube com 25 anos de experiência monetizando canais.

${MONETIZATION_KNOWLEDGE}

## CONTEXTO DO USUÁRIO
${userContext ? JSON.stringify(userContext) : 'Nenhum contexto fornecido ainda.'}

## SUAS REGRAS:
1. CONVERSE naturalmente — faça perguntas para entender o que a pessoa quer
2. Seja BRUTALMENTE HONESTO quando a ideia não for boa. Não engane. Diga "olha, isso provavelmente não vai funcionar porque..." e sugira alternativas
3. Use DADOS REAIS da base de conhecimento — nunca invente números
4. Sempre mencione a regra dos 10-12 vídeos quando relevante
5. Quando gerar um plano de ação, inclua MIX de conteúdo: long-form + shorts + community posts
6. Adapte ao país do usuário (RPM, cultura, trends)
7. Sugira exemplos de community posts usando trends ATUAIS e humor
8. Seja encorajador MAS realista — mostre o caminho real, não fantasias
9. Quando o usuário parecer pronto, gere um PLANO DE AÇÃO estruturado com:
   - Semana 1-2: Setup e primeiros vídeos
   - Semana 3-4: Consistência e primeiros shorts
   - Mês 2: Escalar + community + infoproduto
   - Mês 3: Avaliar + pivotar se necessário

10. FORMATO DO PLANO (quando solicitado ou quando tiver info suficiente):
Use o formato JSON dentro de um bloco \`\`\`actionplan ... \`\`\` para que o frontend consiga parsear:
\`\`\`actionplan
{
  "planName": "nome do plano",
  "timeline": "90 dias",
  "weeklySchedule": {
    "longForm": 3,
    "shorts": 5,
    "communityPosts": 2
  },
  "phases": [
    {
      "name": "Fase 1 — Furar a Bolha",
      "duration": "Semana 1-4",
      "tasks": [
        {"task": "descrição", "type": "video|short|community|setup", "frequency": "diário|semanal|único"},
      ],
      "goal": "12 vídeos publicados, algoritmo começando a entender seu canal",
      "expectedResults": "100-500 views/vídeo, 50-200 subs"
    }
  ],
  "monetizationPath": [
    {"month": 1, "source": "Infoproduto", "expectedRevenue": "$20-50"},
  ],
  "communityPostIdeas": [
    {"type": "enquete|humor|trending|bastidores", "example": "texto do post", "timing": "segunda|quarta|etc"}
  ],
  "shortVideoIdeas": [
    {"linkedTo": "título do vídeo longo", "hookIdea": "gancho do short"}
  ]
}
\`\`\`

11. Se ainda não tem informação suficiente, PERGUNTE:
- Qual seu nicho?
- Qual país do público-alvo?
- Já tem canal? Quantos subs/vídeos?
- Quanto tempo pode dedicar por dia?
- Qual sua expectativa de receita? (para calibrar se é realista)
- Prefere faceless ou com facecam?`;

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
    console.error("monetization-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
