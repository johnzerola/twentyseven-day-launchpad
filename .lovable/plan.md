

# Plano: Limpar botões + mostrar todas as cenas

## O que muda

### 1. Remover botão "Copiar prompt" de cada cena (linhas 1581-1586)
- Deletar o `<div>` com o botão `Copiar prompt` dentro de cada card de cena individual

### 2. Aumentar visibilidade do painel de cenas (linha 1545)
- Trocar `max-h-[400px]` para `max-h-[800px]` no container de cenas, garantindo que todas as cenas fiquem visíveis sem corte
- O scroll continua existindo para roteiros muito longos

### 3. Manter apenas o botão único "Copiar Cenas" no topo
- Já está correto — só existe 1 botão de exportação (linhas 1487-1542). Nenhuma remoção extra necessária nessa parte.

### Arquivo: `src/pages/Scripts.tsx`
- Remover linhas 1581-1586 (botão Copiar prompt por cena)
- Alterar linha 1545: `max-h-[400px]` → `max-h-[800px]`

