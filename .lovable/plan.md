

# ChannelHacker — Plataforma Completa de Monetização YouTube com IA

## Visão Geral
Plataforma all-in-one que ajuda criadores a monetizar canais do YouTube em 27 dias, combinando análise de dados reais, IA conversacional e ferramentas de produção de conteúdo. Inspirada no HacksLabs, TubeMine e DottiFlow, mas indo além com onboarding inteligente e plano personalizado.

---

## Design & Estilo Visual
- **Tema escuro** com gradientes roxo/laranja (estilo premium como os concorrentes)
- **Multi-idioma**: Seletor PT-BR, EN, PL, DE (usando i18n)
- **Landing page** de alta conversão com vídeo, provas sociais, countdown de urgência
- **Dashboard** moderno com sidebar e navegação entre módulos

---

## Módulos da Plataforma

### 1. 🔐 Autenticação & Planos
- Login/cadastro com email (Supabase Auth)
- 3 planos: **Free**, **Pro**, **Full** com Stripe
- Controle de acesso por funcionalidade

### 2. 🤖 Onboarding IA — "Plano 27 Dias"
O coração do app. Quando o usuário cadastra um canal:
- **Pergunta 1**: Canal novo ou existente?
- Se existente: IA analisa o canal via YouTube API (inscritos, views, nicho, RPM estimado)
- **Perguntas individuais** em sequência (estilo chat):
  - Qual seu nicho ou interesse?
  - Quanto tempo por dia pode dedicar?
  - Qual sua meta de ganhos?
  - Que tipo de conteúdo quer criar? (faceless, narração, vlogs)
  - Em qual idioma vai publicar?
- **IA gera plano personalizado de 27 dias** com:
  - Cronograma dia-a-dia (o que fazer cada dia)
  - Metas de vídeos, SEO, thumbnails
  - Estimativa de ganhos baseada em dados reais do nicho
  - Análise de concorrentes do mesmo nicho

### 3. 🔍 Análise de Canais & Nichos (estilo TubeMine)
- **Busca avançada** via YouTube Data API v3:
  - Filtro por inscritos, views, data, idioma, país
  - Encontrar canais pequenos com vídeos "explodindo"
- **Detector de Outliers**: Canais com performance acima da média
- **Análise completa de canal**: Inscritos, views/hora, frequência, nicho, monetização estimada
- **Canais similares**: Sugestões automáticas
- **Favoritos/Tracking**: Salvar canais para acompanhar

### 4. 📝 Gerador de Roteiros IA
- Gera roteiros completos para vídeos de até 30 minutos
- Baseado em análise de vídeos virais do nicho
- Estrutura: Hook → Desenvolvimento → CTA
- Otimizado para retenção de 80%+ (mentalidade do CEO roteirista)
- Sugestões de **títulos com CTR 30%+** e ideias de **thumbnails**

### 5. 🔊 Narração com IA
- Text-to-speech com vozes neurais (via ElevenLabs)
- Múltiplos idiomas (PT, EN, PL, DE, ES)
- Preview e download em MP3
- Sincronização com roteiro

### 6. 📊 Dashboard & Estimativas
- **Estimativa de ganhos** por nicho/RPM
- **Progresso do plano 27 dias** com checklist
- **Métricas dos seus canais** conectados
- **Comparativo** com concorrentes

### 7. 🌐 Landing Page de Conversão
- Hero com headline impactante e vídeo
- Seção de features com ícones
- Provas sociais e depoimentos
- Tabela de preços (Free/Pro/Full)
- FAQ
- Footer com links

---

## Integrações Necessárias
- **Supabase** (Lovable Cloud): Auth, banco de dados, edge functions
- **YouTube Data API v3**: Análise de canais e busca (chave já fornecida)
- **Lovable AI** (Gemini): Chat IA, geração de roteiros, análise inteligente
- **ElevenLabs** (connector): Narração com vozes neurais
- **Stripe**: Pagamentos e assinaturas

---

## Estrutura de Páginas
1. `/` — Landing page
2. `/login` — Login/Cadastro
3. `/dashboard` — Dashboard principal
4. `/onboarding` — Chat IA + Plano 27 dias
5. `/channels` — Meus canais + análise
6. `/search` — Busca avançada de canais/nichos
7. `/scripts` — Gerador de roteiros
8. `/narration` — Gerador de narração
9. `/plan` — Visualização do plano 27 dias
10. `/pricing` — Planos e preços

