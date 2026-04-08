

# Plano: Piloto Automático Inteligente + TTS Resiliente + OAuth Closed-Loop

Após análise detalhada do código, identifiquei os 4 gaps reais e como resolvê-los.

---

## 1. Multi-Act já existe — mas o AutoPilot não o usa corretamente

O `generate-script` já tem o **DYNAMIC MULTI-ACT ENGINE** (linha 998-1272) que ativa para `dur >= 25`. O problema é que o `AutoPilotEngine.tsx` usa `supabase.functions.invoke()` que espera JSON, mas o generate-script retorna **SSE streaming**. Isso causa falha silenciosa para scripts longos.

**Fix:** Reescrever a chamada do AutoPilot para usar `fetch()` com streaming SSE, acumulando o texto igual ao `ScriptGenerator`. Também adicionar opção de duração 40/45/50/60 min no seletor de duração.

**Arquivo:** `src/components/scripts/AutoPilotEngine.tsx`

---

## 2. TTS Fallback Chain — adicionar Lovable AI Gateway como Engine 2.5

O `google-tts/index.ts` já tem 4 engines (Google Cloud → Gemini → ElevenLabs → Browser). O gap: Google Cloud dá 403 (billing) e Gemini dá 429 (quota). O ElevenLabs funciona mas tem limites.

**Fix:** Adicionar o **Lovable AI Gateway** como engine entre Gemini Direct e ElevenLabs. O gateway em `ai.gateway.lovable.dev` usa créditos do usuário e tem quota separada.

```
Engine 1: Google Cloud TTS (keys rotation) — FALHA: 403
Engine 2: Gemini TTS Direct (keys rotation) — FALHA: 429  
Engine 2.5: Gemini TTS via Lovable Gateway (NEW) — créditos separados
Engine 3: ElevenLabs
Engine 4: Browser synthesis
```

**Arquivo:** `supabase/functions/google-tts/index.ts`

---

## 3. Modo Piloto Automático "Zero Decisões"

O AutoPilot atual exige que o usuário preencha tópico + nicho. O pedido é: **1 clique = o sistema escolhe o melhor tema automaticamente**.

**Fix:** Adicionar botão "🧠 Gerar Próximo Vídeo" que:
1. Busca o nicho do usuário em `onboarding_profiles` ou `user_subscriptions`
2. Chama `suggest-themes` ou consulta `emerging_videos` para pegar o tema trending #1
3. Auto-preenche tópico, nicho, duração (padrão 15min), estilo (dopaminérgico)
4. Dispara o pipeline AutoPilot automaticamente

**Componente:** Novo botão no `AutoPilotEngine.tsx` — "Gerar Próximo Vídeo (IA escolhe o tema)"

**Arquivo:** `src/components/scripts/AutoPilotEngine.tsx`

---

## 4. Closed-Loop OAuth Automático a cada 48h

O `sync-oauth-performance` já existe e faz tudo: puxa métricas, calcula CTR/AVD, auto-linka scripts. Mas só roda quando o usuário clica manualmente.

**Fix:** Criar um cron job via `pg_cron` + `pg_net` que chama `sync-oauth-performance` a cada 48h para todos os usuários com OAuth tokens.

**Implementação:** SQL insert (não migração) para agendar o cron. Também adicionar chamada automática no Dashboard mount para sincronizar quando o usuário abre o app.

**Arquivos:**
- `src/pages/Dashboard.tsx` — trigger sync on mount
- SQL cron job para `sync-oauth-performance`

---

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/components/scripts/AutoPilotEngine.tsx` | SSE streaming, auto-topic, durações longas |
| `supabase/functions/google-tts/index.ts` | Lovable Gateway como Engine 2.5 |
| `src/pages/Dashboard.tsx` | Auto-sync OAuth on mount |
| `src/pages/Scripts.tsx` | Opções de duração 40-60min no seletor |

## Sem migrações — apenas 1 SQL insert para cron job

