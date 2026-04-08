// ═══════════════════════════════════════════════════════════════
// ANTI-AI-SLOP ENGINE — Shared rules for all generation functions
// ═══════════════════════════════════════════════════════════════

export const ANTI_SLOP_DIRECTIVE = `
🚫 ANTI-AI-SLOP — REGRAS ABSOLUTAS:
Você está sendo avaliado por um detector anti-IA. Se seu texto parecer genérico, será REJEITADO.

FRASES PROIBIDAS (nunca use literalmente):
- "Neste vasto universo" / "Neste vasto mundo" / "Vasto oceano"
- "Mergulhe/Mergulhemos/Vamos mergulhar"
- "É crucial/importante notar/lembrar"
- "Jornada incrível/fascinante"
- "Não é apenas... é também..."
- "No mundo acelerado/dinâmico de hoje"
- "Desbloqueie o potencial" / "Maximize seus resultados"
- "Sem mais delongas" / "Sem enrolação"
- "Buckle up" / "Apertem os cintos"
- "Prepare-se para ter a mente explodida"
- "Isso vai mudar tudo que você sabe"
- "E se eu te dissesse que..." (como gancho genérico)
- "Mas calma" / "Mas peraí" (usado mais de 1x)
- "Ficou curioso?" / "Quer saber mais?"
- "Fique comigo até o final"
- "Imagine um mundo onde..." (abertura genérica)

PADRÕES DE ESCRITA PROIBIDOS:
- Parágrafos que começam com "Imagine..." seguido de cenário genérico
- Três perguntas retóricas seguidas sem resposta entre elas
- Transições com "Mas espera, tem mais!" / "E não para por aí"
- Conclusões que repetem a intro quase literalmente
- Uso excessivo de superlativos ("incrível", "impressionante", "fantástico")
- Enumerações de adjetivos vazios: "surpreendente, extraordinário e fascinante"
- Parágrafos de "resumo" que não adicionam nada novo
- Repetir a mesma ideia com sinônimos em frases consecutivas
- Não começar com introdução morna ou texto com cara de artigo
- Não despejar informação sem narrativa
- Não exagerar em adjetivos vazios
- Não repetir o tópico principal sem avanço narrativo
- Não encerrar de forma abrupta
- Não escrever frases artificiais de IA
`;

export const SOUL_SIGNALS = `
SINAIS DE "ALMA" OBRIGATÓRIOS (inclua pelo menos 7):
1. Analogia ÚNICA e inesperada (comparar algo técnico com algo cotidiano específico)
2. Confissão ou imperfeição do narrador ("Eu pesquisei isso por 3 semanas e quase desisti quando...")
3. Número ESPECÍFICO e estranho em vez de arredondado (2.347.891 > "milhões")
4. Pausa narrativa intencional — mudar o tom abruptamente por 1-2 frases
5. Referência cultural POP atual conectada ao tema
6. Momento de "eu errei" ou "a maioria pensa errado" com dado surpreendente
7. Frase curta solitária como parágrafo: "Isso não deveria ter acontecido."
8. Pergunta ao espectador que exige reflexão pessoal real
9. DETALHE SENSORIAL micro-específico (textura, cheiro, temperatura, som)
10. CONTRADIÇÃO deliberada que o narrador resolve depois ("Parece loucura. Na verdade, é.")
11. Diálogo interno do narrador — hesita, questiona, muda de opinião
12. Humor inesperado em momento tenso (e vice-versa)
13. Analogias fortes e imagens mentais que transformam dados em cenas
`;

export const ANTI_SLOP_FOR_TITLES = `
🚫 ANTI-SLOP PARA TÍTULOS:
- NUNCA use "Você não vai acreditar" / "Isso vai mudar sua vida"
- NUNCA use mais de 1 emoji por título
- NUNCA use ALL CAPS em mais de 2 palavras
- NUNCA use "Top 10" sem diferenciação
- Prefira números ímpares e específicos (7, 13, 47)
- Cada título deve ter uma TENSÃO implícita ou explícita
- O título deve fazer o espectador PRECISAR saber a resposta
`;

export const ANTI_SLOP_FOR_THUMBNAILS = `
🚫 ANTI-SLOP PARA THUMBNAILS (DARK CHANNEL STRATEGY 2026):
- REGRA ATUAL: Máximo 1-2 elementos na imagem (simplicidade MATA thumbnails complexas)
- NUNCA use mais de 3 palavras de texto overlay
- NUNCA use fundo branco genérico sem elemento focal
- NUNCA use layout simétrico centralizado (assimetria cria TENSÃO)
- O rosto/objeto principal DEVE transmitir emoção EXTREMA
- Cores que CONVERTEM: Branco, Amarelo e Vermelho (testado em milhares de canais)
- A thumbnail deve ser legível em 1 segundo em tela de celular
- ESTRATÉGIA VENCEDORA "Thumbnail Modelada": Pegue capa viral + troque personagens com IA + mantenha psicologia da imagem
- Contraste de cores complementares é OBRIGATÓRIO
`;

export const DARK_CHANNEL_CONTENT_RULES = `
═══ 🎯 REGRAS DE CONTEÚDO DARK CHANNEL 2026 ═══

VALOR HUMANO OBRIGATÓRIO (YouTube pune a falta):
- Roteiro com PERSPECTIVA autoral (não compilação de fatos)
- Curadoria INTELECTUAL: selecionar, organizar, CONECTAR informações
- Humor, ironia, opinião forte — sinais de criador real
- Narrativa ÚNICA mesmo baseada em fatos de terceiros

MODELO "MONEY CHANNEL":
- Nicho hiper-segmentado com RPM alto (>$8)
- Vídeos curtos/médios AFUNILAM para "Super-Vídeo" de 40-60min
- Session Time é a métrica secreta — mantenha viewers NO YouTube
- IP Sintético: avatar/personagem recorrente gera conexão parasocial

EDIÇÃO — ANCORAGEM VISUAL (Regra dos 3-5s):
- Trocar estímulo visual a cada 3-5 segundos
- Pattern interrupts visuais a cada 20-30 segundos
- Lip-sync em momentos de ênfase para avatares
- NUNCA mais de 5s com mesma imagem estática
`;`;
