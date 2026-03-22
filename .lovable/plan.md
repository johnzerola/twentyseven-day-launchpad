

# Aplicar Treinamento DarkPlanner v3 — Ponta a Ponta

## Visão Geral

O documento de treinamento DarkPlanner é um manual profissional completo de 1317 linhas cobrindo 11 etapas para transformar roteiros em prompts de vídeo. O sistema atual já implementa ~60% dessas técnicas, mas faltam elementos críticos. Este plano aplica o treinamento em **3 edge functions** e melhora o frontend.

---

## O que já está implementado vs. O que falta

| Técnica | Status Atual | Ação |
|---------|-------------|------|
| Character Identity Sheets (150-200 palavras, "waist up") | ✅ Parcial — descrições curtas demais | Expandir template |
| Policy Compliance (adaptação de conteúdo sensível) | ✅ Implementado | Manter |
| Movimento obrigatório (3 tipos) | ✅ Implementado | Manter |
| Ambiente detalhado (prevenir fundos brancos) | ✅ Implementado | Manter |
| Fórmula de cálculo de quantidade de prompts | ❌ Ausente | Adicionar lógica `duração ÷ 40s` |
| Auto-Validação com checklist (Etapa 10) | ❌ Parcial — só valida comprimento | Expandir validação pós-geração |
| Formato de entrega DarkPlanner (sem numeração, sem títulos) | ❌ Ausente | Adicionar instrução no prompt |
| Troubleshooting automático (fundos brancos, inconsistência) | ❌ Ausente | Adicionar auto-fix no post-processing |
| Análise automática do roteiro (Etapa 1) | ❌ Ausente | Adicionar pré-análise no frontend |
| Documentário mode (1 prompt/min, sem personagens) | ❌ Parcial | Adicionar lógica condicional |
| Max 2 personagens por prompt — split automático | ❌ Só instrução, sem enforcement | Adicionar validação |
| Estilos expandidos (Ilustração Artística, fotorrealista_documentario) | ✅ Parcial | Adicionar estilos faltantes |
| Trigger words blocker no post-processing | ❌ Ausente | Adicionar scanner automático |

---

## Plano de Implementação

### 1. Upgrade `generate-veo3-prompts/index.ts` — DarkPlanner v3

**Mudanças:**
- Expandir `styleGuides` com estilos faltantes: `ilustracao_artistica`, `aquarela`
- Implementar fórmula de cálculo de prompts: `duração ÷ 40s` com ajustes por tipo (documentário = 1/min, ação = +20%)
- Expandir Character Identity Sheet template para 150-200 palavras com detalhes do treinamento (poros, textura de pele, calluses, expressão)
- Adicionar bloco de **Formato de Entrega** no system prompt: sem numeração, sem títulos de cena, linha em branco entre prompts
- Implementar **Auto-Validação completa** no post-processing:
  - Verificar comprimento mínimo (150 palavras)
  - Scanner de trigger words proibidas (gun, blood, dead, etc.)
  - Verificar presença de anti-text suffix
  - Verificar max 2 personagens por prompt
  - Verificar consistência de descrição de personagens (mesmas palavras-chave)
  - Auto-fix: remover trigger words detectadas, substituir por alternativas seguras
- Adicionar lógica condicional para **Documentário** (sem personagens → 1 prompt/min, foco em locações)

### 2. Upgrade `generate-synced-prompts/index.ts` — DarkPlanner v3

**Mudanças:**
- Aplicar mesma fórmula de cálculo de cenas (`duração ÷ 40s`)
- Expandir template de personagem para formato DarkPlanner completo
- Adicionar formato de entrega (sem numeração/títulos)
- Adicionar post-processing com trigger word scanner e auto-fix
- Adicionar validação de max 2 personagens por cena
- Adicionar lógica documentário

### 3. Upgrade `transcribe-and-generate-scenes/index.ts` — Propagação

**Mudanças:**
- Garantir que os mesmos padrões DarkPlanner v3 propagam para o pipeline de transcrição + geração
- Verificar que a fase de geração de cenas use os mesmos estilos expandidos

### 4. Frontend — Análise Automática de Roteiro (Etapa 1 DarkPlanner)

**Mudanças no `AudioProcessor.tsx`:**
- Antes de gerar cenas, mostrar análise automática do roteiro:
  - Tipo detectado (Ficção/Documentário/Híbrido)
  - Personagens identificados
  - Duração estimada
  - Quantidade de prompts calculada
  - Conteúdo sensível detectado
- Mostrar warnings se >5 personagens (recomendar redução)
- Mostrar badge com quantidade estimada de prompts

### 5. Melhorias Adicionais (Além do Treinamento)

- **Auto-retry com prompt alternativo**: Se trigger word detectada pós-geração, auto-substituir e regenerar prompt afetado
- **Glossário visual**: Adicionar tooltips no SceneViewer explicando termos técnicos (waist up, push-in, rack focus)
- **Export DarkPlanner format**: Botão no PromptExporter para exportar no formato exato do manual (PERSONAGENS + PROMPTS separados, sem numeração)

---

## Detalhes Técnicos

### Trigger Words Scanner (novo módulo reutilizável)

```text
Função utilitária aplicada em post-processing de ambas edge functions:
- Lista de ~40 trigger words proibidas
- Para cada prompt gerado, scanner detecta ocorrências
- Se encontrada: substitui automaticamente por alternativa segura
  (gun → "defensive stance", blood → "dark stain", dead → "covered shape")
- Registra warnings no metadata da resposta
```

### Fórmula de Cálculo de Prompts

```text
base = duração_total / 40
ajustes:
  + ação rápida: × 1.2
  + diálogo parado: × 0.8  
  + documentário sem personagens: duração / 60
  + contemplativo: × 0.85
limites: min 10, max 200
```

### Arquivos Modificados

1. `supabase/functions/generate-veo3-prompts/index.ts` — Reescrita completa com DarkPlanner v3
2. `supabase/functions/generate-synced-prompts/index.ts` — Upgrade de validação e post-processing
3. `supabase/functions/transcribe-and-generate-scenes/index.ts` — Propagação de estilos
4. `src/components/scripts/AudioProcessor.tsx` — Análise automática pré-geração
5. `src/components/scripts/PromptExporter.tsx` — Formato DarkPlanner export

