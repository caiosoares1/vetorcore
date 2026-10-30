# Tabela de sacolas plásticas 2026

Planilha original: [`tabela-sacolas-plasticas-2026.xlsx`](tabela-sacolas-plasticas-2026.xlsx) (fonte da verdade; é uma calculadora com fórmulas).
Preços calculados por modelo, tamanho, quantidade e cores: [`tabela-sacolas-2026-precos.csv`](tabela-sacolas-2026-precos.csv) (340 linhas, valores do arquivo como salvo, fornecedor **2 IRMÃO** a R$ 40/kg).

A migration `supabase/migrations/0002_planilhas_estrutura.sql` criou os campos derivados desta planilha (medidas, espessura, preço por kg do fornecedor). Os **valores** abaixo ainda não estão no banco, e a calculadora de preço por kg/cores/tiragem ainda não existe no app.

## Como o preço é montado

O preço de um lote = **custo de impressão por mil** (Plan1) + **preço do material por mil** (Plan2), ajustado pela quantidade (Plan3).

### 1. Custo de impressão por mil sacolas (Plan1)
Para 1.000 sacolas, área de impressão 0,25 × 0,25 m:

| Item | Fórmula | Valor |
|---|---|---|
| Tempo | 0,12 min × 1.000 / 60 | 2 h |
| Mão de obra | R$ 3.500 / 30 dias / 8 h × 2 h | R$ 29,17 |
| Tinta | fixo | R$ 140,00 |
| Solvente | 50 / 50 | R$ 1,00 |
| Energia | 1,2 × 2 h | R$ 2,40 |
| Energia (adicional) | 40 / 10 | R$ 4,00 |

| Cores | Fórmula | Custo por mil |
|---|---|---|
| 1 cor | mão de obra + tinta + solvente + energia + adicional | R$ 176,57 |
| 2 cores | (mão de obra + tinta + solvente + energia) × 2 | R$ 345,13 |
| 3 cores | idem × 3 | R$ 517,70 |
| 4 cores | idem × 4 | R$ 690,27 |

### 2. Material por mil sacolas (Plan2)
- **kg por mil** = largura (cm) × altura (cm) × espessura (mm).
- **Custo de compra** = kg por mil × preço do kg do fornecedor.
- **Preço com margem** = custo ÷ (1 − 35%).

Preço do kg por fornecedor (Plan3 K30:L33), escolhido em Plan3 E2:

| Fornecedor | R$/kg |
|---|---|
| MAIN | 40 |
| TECNOPLAST | 43 |
| 2 IRMÃO (selecionado) | 40 |
| total mais | 35 |

### 3. Tabela final (Plan3)
- **1.000 unidades**: impressão (1 a 4 cores) + material com margem.
- **500, 250, 125 e 60 unidades**: cada lote é o preço do lote anterior **÷ 1,6** (ou seja, o preço do lote, não por unidade).

Preços para **1.000 unidades** (R$):

| Modelo | Tamanho (cm) | Espessura (mm) | 1 cor | 2 cores | 3 cores | 4 cores |
|---|---|---|---|---|---|---|
| Alça C | 17x24 | 0,011 | 452,75 | 621,32 | 793,88 | 966,45 |
| Alça C | 15x25 | 0,01 | 407,34 | 575,90 | 748,47 | 921,04 |
| Alça C | 20x30 | 0,01 | 545,80 | 714,36 | 886,93 | 1.059,50 |
| Alça C | 25x35 | 0,01 | 715,03 | 883,59 | 1.056,16 | 1.228,73 |
| Alça C | 30x40 | 0,011 | 988,87 | 1.157,44 | 1.330,01 | 1.502,57 |
| Alça C | 30x45 | 0,01 | 1.007,34 | 1.175,90 | 1.348,47 | 1.521,04 |
| Alça C | 35x50 | 0,01 | 1.253,49 | 1.422,06 | 1.594,62 | 1.767,19 |
| Alça C | 40x50 | 0,01 | 1.407,34 | 1.575,90 | 1.748,47 | 1.921,04 |
| Alça C | 40x60 | 0,01 | 1.653,49 | 1.822,06 | 1.994,62 | 2.167,19 |
| Alça C | 45x60 | 0,01 | 1.838,11 | 2.006,67 | 2.179,24 | 2.351,81 |
| Camiseta | 30x32 | 0,006 | 531,03 | 699,59 | 872,16 | 1.044,73 |
| Camiseta | 30x45 | 0,006 | 675,03 | 843,59 | 1.016,16 | 1.188,73 |
| Camiseta | 40x50 | 0,006 | 915,03 | 1.083,59 | 1.256,16 | 1.428,73 |
| Camiseta | 40x60 | 0,006 | 1.062,72 | 1.231,29 | 1.403,85 | 1.576,42 |
| Camiseta | 50x70 | 0,005 | 1.253,49 | 1.422,06 | 1.594,62 | 1.767,19 |
| Camiseta | 60x80 | 0,005 | 1.653,49 | 1.822,06 | 1.994,62 | 2.167,19 |
| Camiseta | 45x60 | 0,006 | 1.173,49 | 1.342,06 | 1.514,62 | 1.687,19 |

Os demais lotes (500, 250, 125 e 60 unidades) estão no CSV.

## Divergências encontradas na planilha
O cálculo usa a espessura **da fórmula de peso** (Plan2, coluna B); as colunas de "ESPESSURA" exibidas nem sempre batem com ela. O CSV e a tabela acima usam a espessura da fórmula.

| Tamanho | Fórmula de peso | Plan2 "ESPESSURA" | Plan3 "ESPESSURA" |
|---|---|---|---|
| Alça C 17x24 | 0,011 | 0,011 | 0,01 |
| Alça C 30x40 | 0,011 | 0,01 | 0,01 |
| Alça C 45x60 | 0,01 | 0,01 | (vazio) |
| Camiseta 30x32, 30x45, 40x50, 40x60 | 0,006 | 0,006 | 0,005 |
| Camiseta 45x60 | 0,006 | 0,005 | 0,005 |

Outros pontos:
- Na Plan2, os tamanhos das camisetas 40x50, 40x60, 50x70, 60x80 e 45x60 aparecem como "BRANCA" na coluna de tamanho; o tamanho real vem da fórmula.
- Na Plan3, os rótulos de tamanho das colunas de 500/250/125 unidades não acompanham a coluna principal em algumas linhas (ex.: linha 10 mostra 30x45, 35x45 e 35X50; linha 17 mostra 30 X 45 e 30 X 40). Os valores seguem sempre a linha da coluna principal (C).
- O custo de impressão de 2 a 4 cores não inclui o adicional de energia (R$ 4,00) que entra no de 1 cor.
- Plan2 I4:M5 e Plan3 B25:J34 têm anotações avulsas (preços de compra e orçamentos comparativos) que não alimentam a tabela final.

Vale confirmar com quem mantém a planilha qual espessura é a correta antes de usar esses preços em produção.
