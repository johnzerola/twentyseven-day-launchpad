
# Reforço do `docs/WORKER_PROTOCOL.md`

O arquivo já existe (395 linhas, gerado na resposta anterior) e cobre endpoints, payloads, idempotência, ffmpeg/LUFS e snippet Python completo. Vou adicionar duas seções que estavam mais enxutas pra deixar **zero ambiguidade** na implementação:

## O que será adicionado

### Seção 0 — Máquina de estados de `video_projects.status` (diagrama ASCII)
Mostra todas as transições possíveis:
- `ready_for_production` → `claimed` (via `claim_next_project`)
- `claimed` → `published` (via `worker-callback action=complete`)
- `claimed` → `ready_for_production` (failed com retries restantes, ou lease expirado pelo `autopilot-recover`)
- `claimed` → `failed` / `failed_permanent` (esgotou `max_retries`)

Lista quais são os **estados terminais** vs **ativos** para o worker nunca pegar algo que não devia.

### Seção 10 — Matriz de retries (quem é responsável pelo quê)

| Cenário                            | Quem decide | Ação no servidor                                  |
|------------------------------------|-------------|---------------------------------------------------|
| Cena Flow.io falhou 1x             | Worker      | retry local até 3x antes de reportar `failed`     |
| Worker crash / VPS reboot          | Servidor    | `autopilot-recover` libera após `claim_expires_at`|
| `event status=failed` recebido     | Servidor    | retry_count++; se < max, volta a `ready_for_production` com backoff (30m/2h/8h) |
| `retry_count >= max_retries`       | Servidor    | `status='failed'`, slot do `channel_schedule` cancelado |
| Upload YouTube falhou no meio      | Worker      | reusar `idempotency_key` na mesma sessão resumable |
| Render passou de 60% do lease      | Worker      | chamar `extend_lease` proativamente               |

### Seção 11 — Erros idempotentes vs não-idempotentes

Lista clara de quais operações o worker pode repetir com segurança (claim, heartbeat, event) e quais precisam de idempotency key (complete, YouTube upload, storage upload).

## Entregável

- Atualização in-place de `docs/WORKER_PROTOCOL.md` (~70 linhas adicionadas)
- Cópia final em `/mnt/documents/WORKER_PROTOCOL.md` para download direto
