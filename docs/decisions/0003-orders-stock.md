# ADR-0003 — Pedido não realiza baixa automática de estoque

- **Estado:** Vigente (comportamento e regra descritos)
- **Data:** Não documentada
- **Escopo:** `CommercePages.tsx`, RPCs de pedidos, README.

## Contexto observado
Há fluxos separados para gerenciamento de pedidos e movimentações de estoque.

## Decisão observada
`create_order_from_quote` cria um pedido a partir de orçamento aprovado que ainda não foi convertido. `set_order_status` altera o estado do pedido. Nenhuma dessas operações baixa `products.qty` automaticamente; a saída é registrada manualmente no módulo Estoque.

## Consequências verificadas
Status `Concluído` não garante que estoque foi reduzido. Agentes não devem adicionar baixa automática como refatoração implícita. Qualquer mudança de regra exige decisão de produto, migração de dados e testes transacionais.

## Dúvidas
A justificativa comercial para separar expedição e conclusão não está documentada. Não presumir integração com faturamento, transporte ou nota fiscal.

## Referências
- `README.md`
- `src/components/CommercePages.tsx`
- `supabase/schema_snapshot.sql`
