---
name: change-stock-flow
description: "Usar quando a tarefa alterar entradas, saídas, saldo disponível, estoque mínimo, histórico de movimentações ou as RPCs de estoque do Vetorcore. Preserva transações e segurança do Supabase."
---

# Fluxos de estoque do Vetorcore

## Investigar
1. Ler `AGENTS.md` e `docs/decisions/0002-stock-rpc.md`; observar a separação pedido/estoque em `0003-orders-stock.md`.
2. Conferir `src/components/RecordEditor.tsx` (MovementForm), `src/lib/domain.ts` (`movementDelta`), `src/App.tsx` (lista e histórico).
3. Inspecionar `public.record_stock_movement` e `private.stock_movement` em `supabase/schema_snapshot.sql`.

## Procedimento
1. Identificar se a mudança é apenas de apresentação/validação ou altera regra transacional no PostgreSQL.
2. Manter delta inteiro positivo para Entrada e negativo para Saída; validar o estoque disponível no frontend **e** no banco.
3. Preservar checagem de membro autenticado, produto não arquivado, bloqueio de linha `FOR UPDATE`, rejeição de saldo negativo e inserção de `stock_movements` na mesma transação.
4. No React, usar `supabase.rpc('record_stock_movement', ...)` e atualizar lista/histórico somente após sucesso.
5. Se precisar mudar SQL, seguir `change-supabase-schema`; propor teste transacional em ambiente isolado com rollback antes de produção.
6. Cobrir limites em `tests/domain.test.mjs` e entradas/saídas, falhas e histórico em `tests/e2e/full-flow.spec.ts`; ajustar mock conforme o contrato real.
7. Rodar `npm run test:coverage`, `npm run build`, `npm run test:e2e`.

## Proibições
- Nunca atualizar `products.qty` diretamente no frontend ou por SQL ad hoc de agente.
- Nunca modificar privilégios ou função `SECURITY DEFINER` sem revisão do `search_path`, de acesso e de RLS.
- Não introduzir baixa automática ao criar/concluir pedido: comportamento vigente é separado.
- Não usar dados reais da empresa em testes.

## Exemplos
- `src/components/RecordEditor.tsx`
- `supabase/schema_snapshot.sql`
- `docs/decisions/0002-stock-rpc.md`
