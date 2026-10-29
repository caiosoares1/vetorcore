# ADR-0002 — Movimentação de estoque por RPC transacional

- **Estado:** Vigente (implementação observada)
- **Data:** Não documentada
- **Escopo:** `RecordEditor.tsx`, `domain.ts`, `stock_movements`, funções RPC.

## Contexto observado
Produtos possuem `qty`; o histórico de mudanças é separado em `public.stock_movements`. O cliente web não recebe permissão de edição direta da quantidade.

## Decisão observada
A interface chama `public.record_stock_movement(product_id, delta, note)`. A implementação privada `stock_movement` verifica membro autorizado, produto ativo, variação válida e saldo não negativo, bloqueia a linha do produto durante o cálculo, atualiza `qty` e insere o movimento na mesma operação de banco.

## Consequências verificadas
Alterar apenas `qty` no código contornaria o histórico e violaria o padrão implementado. A interface também valida quantidades, mas a verificação definitiva deve ocorrer no banco. Produto arquivado não pode ser movimentado pela RPC.

## Dúvidas
O esquema aceita o tipo `Ajuste`, mas não há fluxo de ajuste separado na UI atual. Não introduzir sem definir regra explícita.

## Referências
- `src/components/RecordEditor.tsx`
- `src/lib/domain.ts`
- `supabase/migrations/0001_schema.sql`
- `supabase/schema_snapshot.sql`
