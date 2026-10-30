# ADR-0008 — Custos de sacola no banco e itens personalizados no orçamento

- **Estado:** Proposto (migration `0004_bag_pricing_and_custom_quote_items.sql` ainda precisa ser aplicada no Supabase)
- **Data:** 2026-10-30
- **Escopo:** `supabase/migrations/0004_*.sql`, `scripts/sql/test_0004.sql`, `src/lib/bagPricing.ts`, `src/lib/quoteMath.ts`, `src/lib/domain.ts`, `src/components/BagCalculator.tsx`, `src/components/CommercePages.tsx`
- **Relacionado:** ADR-0007 (calculadora), ADR-0005 (papéis admin/member), ADR-0004 (arquivamento)

## Contexto
Na ADR-0007, custos de impressão, margem e R$/kg ficavam no código: mudar a tinta exigia deploy. E o preço calculado não chegava ao orçamento, porque `create_quote_with_items` só aceita produtos do catálogo e guarda o unitário em centavos — o unitário de sacola tem mais casas (R$ 0,98887), e 1.000 × R$ 0,99 daria R$ 990,00 em vez de R$ 988,87.

## Decisão
1. **Custos no banco:** `public.bag_pricing_settings` (linha única, valores em centavos, margem em %). Membros leem (RLS com `is_vetor_member`); ninguém escreve direto; **só administradores** alteram, pela RPC `set_bag_pricing_settings` (`SECURITY DEFINER`, `search_path` vazio). A calculadora carrega esses valores; sem a tabela, usa os padrões de `bagPricing.ts`.
2. **R$/kg pelo cadastro de fornecedores:** a migration cadastra 2 IRMÃO, MAIN, TECNOPLAST e TOTAL MAIS com o preço do kg (se ainda não existirem). A calculadora usa os fornecedores com "Preço por kg"; a lista do código fica só como reserva.
3. **Item personalizado no orçamento:** `create_quote` aceita, além de `{product_id, quantity}`, o item `{description, quantity, line_total_cents}`. A nova coluna `quote_items.line_total_cents` guarda o **total exato da linha**; o unitário é arredondado só para exibição. `create_order`, a lista, o PDF e a validação no navegador somam `line_total_cents` quando existe.
4. O valor do item personalizado vem do navegador (a fórmula está no frontend). Isso não amplia o que um membro já pode fazer: ele já define preços de produtos no cadastro.

## Consequências
- **Ordem de deploy:** aplicar a 0004 **antes** de publicar o frontend (o frontend lê `line_total_cents`).
- Teste SQL em ambiente isolado: `scripts/sql/test_0004.sql` (BEGIN … ROLLBACK). Foi executado em Postgres descartável com as funções atuais de produção; não substitui um teste no Supabase.
- Rollback documentado no fim da migration; itens personalizados criados depois dela precisam ser tratados antes.
