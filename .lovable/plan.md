

# Plano de Blindagem de Segurança contra Hackers

## Vulnerabilidades Encontradas (16 issues no scan)

### ERROS CRITICOS (5)
1. **Storage: qualquer user pode deletar/inserir arquivos de outros** -- policies de INSERT e DELETE no bucket `media` não verificam ownership
2. **YouTube OAuth tokens em plaintext** -- `access_token` e `refresh_token` expostos se houver qualquer brecha
3. **OAuth state tokens sem policy** -- RLS habilitado mas 0 policies = tabela inacessivel (ok) mas sem cleanup de expirados
4. **Realtime sem autorização** -- `video_performance` e `processing_jobs` publicados no Realtime sem filtro por user
5. **user_subscriptions UPDATE aberto** -- qualquer user autenticado pode alterar seu próprio tier/credits via UPDATE policy sem restrição de colunas

### WARNINGS (6)
6. **task_queue** SELECT com `USING: true` -- todos users veem todas tasks
7. **execution_logs** SELECT com `USING: true` -- expõe nomes de funções e erros internos
8. **api_config** SELECT com `USING: true` -- expõe nomes de env vars
9. **api_usage** SELECT com `USING: true` -- expõe métricas internas
10. **Leaked Password Protection desabilitado**
11. **4 Materialized Views** expostas na API pública

---

## Plano de Implementação

### Passo 1: Corrigir Storage (CRITICO)
Migration SQL para:
- DROP policies atuais de INSERT e DELETE no bucket `media`
- Recriar com ownership check: `(storage.foldername(name))[1] = auth.uid()::text`

### Passo 2: Blindar user_subscriptions (CRITICO)
- **REMOVER** a policy de UPDATE que permite users alterarem seu próprio tier
- Criar policy UPDATE restrita: users só podem atualizar `active_devices` (não tier, credits, etc.)
- Ou melhor: remover UPDATE completamente e deixar apenas service_role alterar via edge functions

### Passo 3: Políticas para oauth_state_tokens
- Criar policy SELECT/INSERT/DELETE scoped por `auth.uid() = user_id`
- Criar cron ou trigger para limpar tokens expirados (`expires_at < now()`)

### Passo 4: Restringir tabelas internas
Migration para trocar policies de `USING: true` por `USING: false` (service_role only):
- `task_queue` -- remover SELECT público
- `execution_logs` -- remover SELECT público  
- `api_config` -- remover SELECT público
- `api_usage` -- remover SELECT público

### Passo 5: Proteger Materialized Views
- Revogar acesso das 4 views (`mv_niche_benchmarks`, `mv_avg_scores_by_niche`, `mv_top_hooks_by_niche`, `mv_top_titles_by_views`) do role `anon` e `authenticated`
- Acessar apenas via security definer functions

### Passo 6: Habilitar Leaked Password Protection
- Usar `configure_auth` com `password_hibp_enabled: true`

### Passo 7: Proteção do consume_credits
- A function `consume_credits` já verifica `auth.uid() IS DISTINCT FROM _user_id` -- OK
- Mas `handle_new_user` dá `studio` + 1000 créditos para todo novo signup -- **CORRIGIR para `starter` + 100**

### Passo 8: Rate limiting no client
- Adicionar throttle nas chamadas de edge functions mais caras para prevenir abuso

---

## Resumo de Impacto

| Fix | Risco eliminado |
|---|---|
| Storage ownership | User A deletar/sobrescrever arquivos de User B |
| Remover UPDATE em subscriptions | User alterar seu próprio tier para `studio` via DevTools |
| Tabelas internas service-role only | Vazamento de infraestrutura interna |
| OAuth state policies | Tokens órfãos e acesso cruzado |
| handle_new_user → starter | Novos users recebendo Studio grátis |
| HIBP password check | Senhas comprometidas usadas no signup |

**Estimativa:** 1 migration SQL grande + 1 config de auth + ajuste no trigger `handle_new_user`.

