

# Status do Plano — O que foi feito vs. O que falta

## Implementado (Phases 1-6)

| Fase | Status | Detalhes |
|------|--------|----------|
| **Phase 1: Database** | DONE | Tabelas `profiles`, `user_channels`, `onboarding_plans`, `saved_scripts` com RLS |
| **Phase 2a: Edge Function analyze-channel** | DONE | YouTube API + Gemini para análise real de canal |
| **Phase 2b: Edge Function generate-plan** | DONE | Plano 27 dias com IA (3 CEOs personas) |
| **Phase 2c: Edge Function generate-script** | DONE | Roteiros com streaming real via Gemini |
| **Phase 3: Onboarding Overhaul** | DONE | Chat interativo, análise de canal, salva plano no DB |
| **Phase 4: Channel Search (TubeMine-style)** | DONE | Filtros avançados (idioma, país, período, views, likes, subs), badge Outlier |
| **Phase 5: My Channels (Link & Compare)** | DONE | Adicionar canais, comparar side-by-side, stats do YouTube |
| **Phase 6: Script Generator com IA real** | DONE | Streaming, word/char count, histórico salvo no DB |

---

## O que ainda NÃO foi feito (mencionado no plano expandido)

| Item | Status | O que falta |
|------|--------|-------------|
| **Narração (ElevenLabs)** | MOCK | Página existe mas usa `setTimeout` — não conecta a nenhuma API de TTS |
| **Stripe / Pagamentos** | NAO FEITO | Sem integração de planos Free/Pro/Full |
| **Proteção de rotas** | NAO FEITO | Usuários não logados acessam tudo sem redirect para `/login` |
| **Dashboard dinâmico** | PARCIAL | Cards estáticos com "0 canais", "0 roteiros" — não puxa dados reais do DB |
| **Estimativas de ganhos (RPM por país)** | PARCIAL | O plano gerado inclui RPM, mas não há módulo dedicado de simulação |
| **Pipeline de vídeo (scenes, FFmpeg, export)** | NAO FEITO | Era parte do prompt expandido do usuário (video factory) |
| **OAuth YouTube** | NAO FEITO | Análise funciona por URL/ID, mas sem vincular conta YouTube via OAuth |

---

## Recomendação de próximos passos (por prioridade)

1. **Proteção de rotas** — redirect para `/login` em todas as páginas do dashboard
2. **Dashboard dinâmico** — puxar contadores reais (canais, scripts, progresso do plano)
3. **Narração com ElevenLabs** — conectar connector e criar edge function de TTS
4. **Stripe** — ativar planos pagos com controle de acesso por feature
5. **Pipeline de vídeo** — funcionalidade mais complexa, requer FFmpeg/workers

As 6 fases do plano principal foram **todas implementadas**. Os itens pendentes são funcionalidades extras mencionadas no prompt expandido do usuário.

