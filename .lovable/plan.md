

# Workflow → Project Workspace

## O Que Muda

A página atual é uma lista simples de projetos com filtro por status. A nova versão será um **gerenciador de produção completo** com:

1. **Painel expandido por projeto** — clicar em um projeto abre detalhes inline mostrando: roteiro (preview), cenas geradas, canal vinculado, e ações rápidas
2. **Vinculação a canal** — campo opcional `channel_id` no `video_projects` para linkar projeto a um canal do usuário
3. **Transição automática de status** — detecta se tem roteiro (→ script), se tem cenas (→ scenes) automaticamente
4. **Dashboard de produtividade** — cards no topo: projetos esta semana, roteiros gerados, cenas prontas, publicados
5. **Ações contextuais inteligentes** — cada projeto mostra a próxima ação lógica: "Criar Roteiro", "Gerar Cenas", "Exportar AutoFlow"
6. **Busca e filtro por canal** — filtrar projetos por canal vinculado além de status/nicho

## Mudanças no Banco de Dados

**Migration**: Adicionar coluna `channel_id` (text, nullable) à tabela `video_projects` para vincular projetos a canais do usuário.

## Implementação

### A. Migration SQL
- `ALTER TABLE video_projects ADD COLUMN channel_id text DEFAULT NULL`

### B. Rewrite `src/pages/Workflow.tsx`
- **Header**: Título + stats cards (total, esta semana, com roteiro, com cenas)
- **Filtros**: Status pills + dropdown de canal + busca por texto
- **Lista de projetos**: Cards expandíveis com:
  - Status visual (progress stepper de 4 etapas)
  - Preview do roteiro (primeiras 200 chars)
  - Contagem de cenas e personagens
  - Canal vinculado (thumbnail + nome)
  - Botões de ação contextual baseados no status atual
  - Dropdown para mudar status, deletar, vincular canal
- **Painel expandido** (ao clicar): mostra roteiro completo, lista de cenas, personagens, botões para ir ao Scripts com projectId
- **Dialog de criação**: título + nicho + canal (select dos `user_channels`) + duração estimada
- **Auto-status**: ao carregar, detecta se projeto tem `script.length > 50` → status mínimo "script"; se `scene_count > 0` → status mínimo "scenes"

### C. Dados carregados
- `video_projects` (todos do usuário)
- `scenes` (count por projeto)
- `characters` (count por projeto)
- `user_channels` (para o select de vinculação e display)

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | ADD COLUMN `channel_id` |
| `src/pages/Workflow.tsx` | Rewrite completo |

