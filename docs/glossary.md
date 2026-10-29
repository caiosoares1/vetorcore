# Glossário do domínio — Vetorcore

| Termo | Significado no sistema | Referência |
| --- | --- | --- |
| Produto | Item comercial identificado por `sku`, nome, categoria, custo, preço e saldo | `public.products`, `RecordEditor.tsx` |
| SKU | Código único do produto; `sku` possui restrição `unique` no banco | `0001_schema.sql`, `domain.ts` |
| Categoria | Agrupamento textual do produto ou do tipo de fornecimento | `products.category`, `suppliers.category` |
| Fornecedor | Empresa/pessoa que fornece itens; pode ser vinculada a um produto | `suppliers`, `products.supplier_id` |
| Cliente | Destinatário de orçamentos e pedidos | `customers`, `quotes.customer_id` |
| Estoque / saldo | Quantidade disponível `products.qty` (inteiro não negativo) | `products`, `record_stock_movement` |
| Estoque mínimo | Limite `min_qty` utilizado para sinalizar produto com saldo baixo | `App.tsx`, `domain.ts` |
| Entrada | Movimento de estoque com `delta` positivo | `stock_movements` |
| Saída | Movimento de estoque com `delta` negativo | `stock_movements` |
| Ajuste | Valor permitido no campo `kind` do esquema inicial; não há fluxo de ajuste separado visível na interface atual | `0001_schema.sql` |
| Movimentação | Registro auditável de produto, variação, tipo, observação, ator e data | `stock_movements` |
| Custo / preço de venda | Valores monetários persistidos como inteiros em centavos (`cost_cents`, `price_cents`) | `products`, `quoteMath.ts` |
| Orçamento / proposta | Cotação comercial com cliente, estado, itens, desconto e observações | `quotes`, `quote_items` |
| Item do orçamento | Produto, nome de referência, quantidade e preço unitário preservado na proposta | `quote_items` |
| Desconto | Valor em centavos aplicado ao subtotal do orçamento; não pode superá-lo | `discount_cents`, `quoteTotals` |
| Estado do orçamento | `Rascunho`, `Enviado`, `Aprovado` ou `Recusado` | `CommercePages.tsx`, RPC `set_quote_status` |
| Pedido | Registro gerado de orçamento aprovado; conversão única por orçamento | `orders`, RPC `create_order_from_quote` |
| Estado do pedido | `Em separação` ou `Concluído`; não implica baixa automática de estoque | `orders`, RPC `set_order_status` |
| Modelo / medidas da sacola | Atributos opcionais do produto: `model` (ex.: boca de palhaço, alça camiseta), `width_cm`, `height_cm`, `gusset_cm` (sanfona) e `thickness_mm` (espessura) | `products`, migration `0002` |
| Margem | `(preço − custo) / preço`, calculada na interface a partir do cadastro; não é persistida | `productMargin` em `domain.ts` |
| Preço por kg | Valor do quilo cobrado pelo fornecedor de sacolas plásticas, em centavos | `suppliers.price_per_kg_cents` |
| Custo da entrada | Custo unitário e fornecedor opcionais registrados em uma Entrada; não alteram `products.cost_cents` | `stock_movements.unit_cost_cents`, `supplier_id` |
| Frete / entrega / pagamento | Campos do orçamento; o frete soma ao total e entra no `total_cents` do pedido | `quotes.freight_cents`, `delivery_date`, `payment_terms` |
| Arquivamento | Ocultação reversível via `archived_at` em vez de exclusão definitiva | `products`, `customers`, `suppliers` |
| Usuário autorizado | Conta autenticada com UUID incluído em `public.app_members` | `AuthGate.tsx`, RLS |
| RLS | Row Level Security do PostgreSQL; restringe acesso aos dados por usuário/política | `supabase/schema_snapshot.sql` |
| RPC | Chamada do frontend a função SQL, por exemplo `record_stock_movement` | `supabase.rpc`, `schema_snapshot.sql` |
| PWA | Aplicativo web instalável, com service worker e aviso de atualização | `vite.config.ts`, `main.tsx` |

As descrições acima refletem o comportamento implementado. Não significam que o Vetorcore emita NF-e, processe pagamentos ou controle automaticamente expedição.
