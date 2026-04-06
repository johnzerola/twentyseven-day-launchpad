

# Plano: Canais de Referência Pessoais — Sistema de Modelagem Inteligente

## Contexto Atual

Hoje existe uma tabela `reference_channels` global (canais de referência do sistema) e `user_channels` (canais do próprio usuário). Mas **não existe vínculo entre o usuário e canais de referência específicos que ele escolhe como modelo**. As sugestões de vídeo (`suggest-themes`) usam apenas os dados do canal do usuário + concorrentes genéricos, sem considerar canais-modelo escolhidos pelo usuário.

## O que vou construir (indo além do que você pediu)

Não vou apenas "salvar canais de referência". Vou criar um **sistema de modelagem contínua** onde os canais de referência do usuário se tornam uma fonte ativa de inteligência que alimenta TODO o pipeline.

### Arquitetura

```text
┌─────────────────────────────────────────────────────┐
│           user_reference_channels (nova tabela)      │
│  user_id │ channel_id (channel_intelligence) │ role  │
│  ───────   ─────────────────────────────────   ──── │
│  usr_1   │ UCxxx (MrBeast)                   │ style │
│  usr_1   │ UCyyy (Nexpo)                     │ hook  │
│  usr_1   │ UCzzz (Leirbag)                   │ model │
└──────────────┬──────────────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │  refresh-references  │  (nova edge function)
    │  Cron ou on-demand   │
    │                      │
    │  1. YouTube API:     │
    │     últimos 10 vídeos│
    │     de cada ref      │
    │                      │
    │  2. Gemini analisa:  │
    │     títulos, hooks,  │
    │     formatos que     │
    │     performaram      │
    │                      │
    │  3. Salva em         │
    │     reference_intel  │
    │     (JSON no vínculo)│
    └──────────┬──────────┘
               │
    ┌──────────▼──────────────────────────┐
    │  Injeção automática no pipeline:    │
    │                                      │
    │  suggest-themes   → "seus refs      │
    │                      postaram X"     │
    │  generate-script  → "modelo de hook │
    │                      do canal Y"     │
    │  generate-titles  → "padrão título  │
    │                      do canal Z"     │
    │  chat-assistant   → contexto Dotti  │
    └─────────────────────────────────────┘
```

### Diferenciais vs o que você pediu

1. **Papel por referência**: Cada canal de referência tem um `role` — o usuário pode dizer "quero modelar o ESTILO do MrBeast, os HOOKS do Nexpo e o FORMATO do Leirbag". Isso permite injeção cirúrgica.

2. **Intel snapshot automático**: Toda vez que o usuário gera um roteiro ou pede sugestões, o sistema verifica se os canais de referência foram atualizados nos últimos 7 dias. Se não, faz refresh silencioso dos últimos 10 vídeos.

3. **Padrões extraídos, não vídeos brutos**: O Gemini analisa os últimos vídeos e extrai: padrões de título, tipos de hook, duração média, formato dominante, e "o que mudou desde o último scan". Isso vira contexto compacto, não dump de dados.

4. **Comparativo de evolução**: O sistema detecta quando um canal de referência muda de estratégia (ex: passou de vídeos de 20min para Shorts) e avisa o usuário.

## Implementação

### 1. Migration: Tabela `user_reference_channels`
```sql
CREATE TABLE public.user_reference_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_intelligence_id uuid REFERENCES public.channel_intelligence(id) ON DELETE SET NULL,
  youtube_channel_id text NOT NULL,
  channel_name text NOT NULL,
  thumbnail text,
  role text DEFAULT 'model', -- 'model', 'style', 'hook', 'format'
  latest_intel jsonb DEFAULT '{}',
  last_scanned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, youtube_channel_id)
);
ALTER TABLE public.user_reference_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own refs" ON public.user_reference_channels
  FOR ALL USING (auth.uid() = user_id);
```

### 2. Nova Edge Function: `refresh-references`
- Recebe `user_id` (ou executa para todos usuários com refs não escaneados há >7 dias)
- Para cada canal de referência: busca últimos 10 vídeos via YouTube API
- Gemini Flash extrai: `title_patterns`, `hook_types`, `avg_duration`, `format_shift`, `top_performing_elements`
- Salva em `latest_intel` (JSON compacto ~500 chars por canal)

### 3. UI: Aba "Referências" na página Channels
- Nova tab ao lado de "Visão Geral", "Concorrentes", "Sugestões"
- Interface para adicionar até 5 canais de referência (input URL + select role)
- Cards mostrando: último vídeo, padrão de título, hook dominante, status do scan
- Botão "Atualizar referências" (manual)

### 4. Injeção no Pipeline
- `suggest-themes`: Adicionar bloco de contexto "Canais de referência do usuário postaram recentemente: [títulos + performance]"
- `chat-assistant`: Dotti recebe `reference_channels_context` no user state
- `generate-titles`: Padrões de título dos refs como exemplos adicionais

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| **Migration** | Criar `user_reference_channels` com RLS |
| `supabase/functions/refresh-references/index.ts` | **Nova** — scan + extração Gemini |
| `src/pages/Channels.tsx` | Nova aba "Referências" com CRUD |
| `supabase/functions/suggest-themes/index.ts` | Injetar contexto dos refs |
| `supabase/functions/chat-assistant/index.ts` | Carregar refs no user state |

### Detalhes Técnicos
- 5 arquivos (1 novo, 4 editados) + 1 migration
- Limite de 5 canais de referência por usuário (controle de custo)
- YouTube API: ~1 request por canal de referência por scan (quota mínima)
- Gemini Flash-Lite para extração de padrões (custo ~$0.001 por scan)

