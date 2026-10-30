# ADR-0007 — Calculadora de preço de sacolas impressas

- **Estado:** Aceito
- **Data:** 2026-10-30
- **Escopo:** `src/lib/bagPricing.ts`, `src/components/BagCalculator.tsx`, `tests/bag-pricing.test.mjs`, `tests/fixtures/tabela-sacolas-2026-precos.csv`
- **Relacionado:** ADR-0006; substitui a planilha `TABELA DE SACOLAS PLÁSTICAS 2026.xlsx`

## Contexto
O preço de sacolas impressas era calculado numa planilha: impressão por mil (mão de obra, tinta, solvente, energia) + material por mil (largura × altura × espessura × R$/kg do fornecedor, com margem de 35%), com lotes menores obtidos dividindo o anterior por 1,6. A operação confirmou que os preços finais estão corretos, que a espessura varia por fornecedor (normal 0,010 mm, até 0,012 mm) e como cobra quantidades fora dos lotes.

## Decisão
1. **Calcular, não tabelar.** Como espessura e R$/kg mudam o preço, o app refaz a conta da planilha em vez de guardar 340 preços fixos. As 340 combinações não viram produtos do catálogo (sacola impressa é sob encomenda; o catálogo continua para itens com estoque).
2. **Regra de quantidade** (informada pela operação): usa-se o maior lote da tabela que caiba na quantidade; preço = preço do lote ÷ tamanho do lote × quantidade. Ex.: 3.000 = milheiro × 3; 700 = lote de 500 ÷ 500 × 700. Abaixo de 60 un., usa-se o preço unitário do lote de 60 e a tela avisa.
3. **O código é a referência de preço.** Tudo o que a planilha continha foi transcrito para `src/lib/bagPricing.ts`: fórmulas (documentadas no topo do arquivo), custos de impressão, margem, lotes, tamanhos padrão com espessura de referência e o preço do kg dos fornecedores de material (2 IRMÃO e MAIN R$ 40, TECNOPLAST R$ 43, TOTAL MAIS R$ 35). A planilha deixa de ser usada.
4. **Fidelidade:** inclusive o adicional de energia (R$ 4) só na impressão de 1 cor. Um teste confere 340 preços de referência de 2026 ao centavo, com os parâmetros de 2026 fixados no próprio teste — assim os valores atuais podem mudar no código sem quebrá-lo.
5. **Sem banco nesta etapa:** o R$/kg vem da lista de referência, de `suppliers.price_per_kg_cents` ou é digitado; custos e margem podem ser ajustados na tela só para a simulação.

## Consequências
- Mudança de custo (ex.: tinta) ou de R$/kg hoje é feita alterando as constantes de `bagPricing.ts` (e um deploy); guardar esses parâmetros no banco, editáveis pela tela, fica para uma próxima etapa.
- Levar o preço calculado para um orçamento exige alterar `create_quote_with_items` (hoje só aceita produtos do catálogo) — mudança de banco a ser tratada em ADR próprio.
