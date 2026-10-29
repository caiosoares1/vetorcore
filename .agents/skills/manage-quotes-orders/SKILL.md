---
name: manage-quotes-orders
description: "Usar ao desenvolver ou corrigir orçamentos, seus itens e descontos, estados de propostas, conversão e conclusão de pedidos ou exportação de PDF no Vetorcore."
---

# Orçamentos, pedidos e PDF

## Referências obrigatórias
1. Ler `docs/architecture.md`, `docs/glossary.md`, `docs/decisions/0003-orders-stock.md`.
2. Inspecionar `src/components/CommercePages.tsx`, `src/lib/domain.ts`, `src/lib/quoteMath.ts`.
3. Conferir RPCs de `quotes`, `quote_items` e `orders` em `supabase/schema_snapshot.sql` antes de sugerir SQL.

## Passos
1. Na criação, validar cliente e produto ativos; quantidade inteira positiva, sem produto duplicado e desconto menor ou igual ao subtotal. Usar `validateQuoteDraft`.
2. Armazenar/computar valores em inteiros `*_cents` e usar `toCents`, `quoteTotals`, `fmtCents`; não persistir valores float.
3. Enviar itens na RPC `create_quote_with_items`, não criar `quotes` e `quote_items` em escritas independentes no navegador.
4. Para status, usar `set_quote_status`; converter somente proposta aprovada e ainda não convertida por `create_order_from_quote`; concluir por `set_order_status`.
5. Exportar no navegador via `jsPDF` como em `savePdf` de `CommercePages.tsx`; inspecionar cabeçalho/arquivo do PDF nos testes.
6. Atualizar estados de carregamento/erro na UI com `errorMessage` e refazer consultas após operações bem-sucedidas.
7. Cobrir cálculos em `tests/quote-math.test.mjs` e `tests/domain.test.mjs`; jornadas de proposta→pedido/PDF em `tests/e2e/full-flow.spec.ts` com `mockSupabase.ts`.
8. Rodar `npm run test:coverage`, `npm run build`, `npm run test:e2e`.

## Nunca fazer
- Não converter orçamento recusado/rascunho em pedido por atalho do frontend.
- Não permitir múltiplos pedidos para o mesmo orçamento.
- Não assumir que conclusão do pedido reduz estoque.
- Não inventar integração de pagamento, NF-e, expedição ou armazenamento remoto de PDFs.

## Exemplos
- `src/components/CommercePages.tsx`
- `src/lib/quoteMath.ts`
- `supabase/schema_snapshot.sql`
