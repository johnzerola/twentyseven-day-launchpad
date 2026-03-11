

# Auditoria Completa do Sistema — 3 CEOs

Após análise profunda de cada tela, edge function, tabela e fluxo, aqui está o diagnóstico consolidado dos 3 especialistas.

---

## BUGS CRÍTICOS (quebram funcionalidade)

### 1. Meus Canais — Concorrentes usa COUNTRIES incorreto
Em `Channels.tsx` linha 668, o componente usa um array local `COUNTRIES` com propriedade `code`, mas em todo o resto do app usa-se `COUNTRIES` de `@/lib/constants` com propriedade `value`. Os badges de país na aba Concorrentes referenciam `c.code` enquanto o array importado deveria usar `c.value`. Isso pode estar causando inconsistência.

### 2. Meus Canais — Botão "Canais Similares" não faz nada
Em `ChannelSearch.tsx` linha 425-427, o botão "Canais Similares" na card do canal não tem `onClick`. Está morto.

### 3. channel_intelligence / scene_prompt_knowledge / script_knowledge — RLS bloqueia INSERT para usuários autenticados
Essas 3 tabelas só têm policy de SELECT. O auto-enrich funciona via SERVICE_ROLE_KEY (ok), mas qualquer tentativa do frontend de inserir seria bloqueada. Não é bug agora, mas será se algum fluxo do frontend tentar escrever.

---

## PROBLEMAS DE UX / EFICIÊNCIA

### 4. Growth Center — Simulador de Receita com dados genéricos
O Revenue Simulator usa constantes hardcoded (`GROWTH_CURVE`, `RPM_BY_NICHE`). Não conecta com o canal real do usuário. Seria muito mais útil se puxasse dados reais do canal vinculado (`user_channels.analysis_json`) e comparasse com canais similares da `channel_intelligence`.

### 5. Growth Center — Brand Kit / Thumbnail Lab / Content Matrix / Growth Checklist
Todos pedem "nicho" manualmente. Se o usuário já tem canal vinculado, deveria auto-preencher. Também não salvam resultados persistentes (exceto o checklist).

### 6. DubSpy — Aba "Emerging" e "Escapees" e "Cluster" estão em componentes separados
Precisam ser verificados independentemente. Funcionam chamando edge functions que dependem de YouTube API + IA.

### 7. Niche Explorer — Variáveis definidas APÓS o uso
`YPP_SUBS` e `YPP_HOURS` são definidas na linha 756-757, após serem usadas na linha 304. Isso funciona em JS por hoisting de `const` no scope do módulo, mas é confuso. Não é bug real.

---

## PLANO DE MELHORIAS (Consenso dos 3 CEOs)

### A. Corrigir Bugs
1. **Unificar COUNTRIES** em `Channels.tsx` — remover array local e usar o de `@/lib/constants`
2. **Remover ou implementar** botão "Canais Similares" morto no DubSpy
3. **Mover `YPP_SUBS`/`YPP_HOURS`** para `constants.ts` para consistência

### B. Transformar Growth Center em Command Center Conectado
Substituir o Growth Center atual por algo que realmente use dados do usuário:
- **Revenue Simulator Conectado**: puxa automaticamente os dados do canal do usuário (subs, views, niche, country) e compara com canais similares da `channel_intelligence`
- **Auto-preencher nicho**: em Brand Kit, Thumbnail Lab e Content Matrix, pré-preencher com dados do `user_channels`
- **Salvar resultados**: Brand Kit e Content Matrix salvos em novas colunas no perfil ou tabela dedicada
- **Adicionar "Competitor Spy Card"**: no Growth Center, mostrar um resumo dos 3 concorrentes mais próximos do canal do usuário (via `find-competitors`)

### C. Niche Explorer — Adicionar "Action Mode"
Quando o score de um nicho é alto (>70), mostrar um botão "Iniciar Pipeline" que leva direto ao Roteiros com o nicho e estilo pré-preenchidos. Conectar a análise ao pipeline de roteiros.

### D. DubSpy — Verificar e Melhorar
- Verificar se Emerging/Escapees/Cluster realmente retornam dados úteis
- Adicionar "Exportar para Roteiro" em cada vídeo outlier encontrado — já existe parcialmente via Deep Scan, mas pode ser mais direto

### E. Dashboard — Métricas Reais
O dashboard atual mostra contadores simples. Transformar em:
- Gráfico de evolução de projetos/roteiros ao longo do tempo
- Última análise do Niche Explorer inline
- Progresso do Monetization Coach (se tem plano ativo)
- Próximas ações recomendadas baseadas no workflow

### F. Banco de Dados — Limpeza
- A tabela `outlier_channels` armazena vídeos outlier por usuário mas não parece ser usada em nenhuma tela
- `planner_cards` existe mas não há tela de Planner Kanban visível no nav (existe `Planner.tsx` no router? Não — não está no App.tsx)
- Considerar remover tabelas órfãs ou criar as telas correspondentes

---

## ARQUIVOS A EDITAR

| Arquivo | Ação |
|---------|------|
| `src/pages/Channels.tsx` | Corrigir COUNTRIES, remover array local |
| `src/pages/ChannelSearch.tsx` | Remover ou implementar botão "Canais Similares" |
| `src/lib/constants.ts` | Adicionar YPP_SUBS, YPP_HOURS |
| `src/pages/NicheExplorer.tsx` | Importar YPP constants |
| `src/pages/Branding.tsx` | Conectar ao canal do usuário, auto-preencher nicho, salvar resultados |
| `src/pages/Dashboard.tsx` | Adicionar métricas visuais e recomendações |
| `src/pages/Branding.tsx` (Revenue Sim) | Conectar com dados reais do canal |

---

## RESUMO EXECUTIVO

O sistema tem uma arquitetura sólida e um pipeline de inteligência impressionante. Os bugs são menores (botão morto, array duplicado). O maior gap é que várias telas operam de forma isolada — pedem dados que o sistema já tem. A melhoria mais impactante é **conectar todas as telas aos dados reais do usuário** (canal vinculado, análises salvas, nicho detectado) para que cada ferramenta seja contextual e não genérica.

