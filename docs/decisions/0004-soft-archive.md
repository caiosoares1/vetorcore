# ADR-0004 — Arquivamento reversível de cadastros

- **Estado:** Vigente (implementação observada)
- **Data:** Não documentada
- **Escopo:** produtos, clientes, fornecedores, `App.tsx`, RPCs.

## Contexto observado
Produtos possuem movimentos e itens de orçamento associados; clientes e fornecedores também se relacionam com outros registros.

## Decisão observada
A UI usa `archived_at` em `products`, `customers` e `suppliers`, oferecendo arquivar/restaurar e filtrar ativos/arquivados. As RPCs impedem usar produtos arquivados em nova movimentação/proposta e clientes arquivados em nova proposta. Não há exclusão física de cadastros no fluxo atual.

## Consequências verificadas
O histórico permanece disponível; consultas e seletores de novas operações precisam considerar `archived_at`. Restaurar limpa a marca de arquivamento.

## Dúvidas
Políticas de retenção, exclusão definitiva e comportamento diante de vínculos externos não estão formalizadas.

## Referências
- `src/App.tsx`
- `src/components/CommercePages.tsx`
- `src/lib/domain.ts`
- `supabase/schema_snapshot.sql`
