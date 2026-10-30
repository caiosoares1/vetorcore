# ADR-0006 — Design system com Tailwind CSS e componentes no padrão shadcn/ui

- **Estado:** Aceito
- **Data:** 2026-10-30
- **Escopo:** `src/index.css`, `src/components/ui/`, `src/components/Shell.tsx`, todas as telas
- **Substitui:** o tema escuro gerado (`scripts/gen-dark-theme.mjs` → `src/dark.css`)

## Contexto
A interface usava três folhas de CSS escritas à mão com cores literais e um script que derivava o tema escuro remapeando cada cor em OKLCH. Isso dificultava evoluir o visual: cada componente repetia estilos, novas cores exigiam regenerar o tema e componentes acessíveis (diálogos, menus) eram implementados manualmente. O pedido foi um redesign moderno, mantendo as cores da logo e todas as funcionalidades.

## Decisão
1. **Tailwind CSS v4** (`@tailwindcss/vite`) com **tokens de cor** em `src/index.css`: um conjunto em `:root` (claro) e outro em `:root[data-theme="dark"]`, expostos ao Tailwind por `@theme inline`. O mecanismo de tema (`data-theme`, `vetor.theme`, script anti-piscar no `index.html`) não mudou.
2. Cores da marca vindas da logo: índigo `#363890` (primária, barra lateral) e laranja `#ff862b` (destaques, botão de ação principal do início, indicador da navegação).
3. **Componentes no padrão shadcn/ui escritos no repositório** (`src/components/ui/`), sobre primitivas **Radix** (Dialog, AlertDialog, DropdownMenu, Slot) e `class-variance-authority`. Não se usa o CLI do shadcn: os componentes são nossos e editáveis.
4. **Selects nativos** estilizados (`NativeSelect`) em vez do Select do Radix: no celular abrem o seletor do sistema e continuam compatíveis com `selectOption` nos testes.
5. Navegação: barra lateral agrupada (Comercial, Operação, Administração) no desktop; no celular, 4 telas fixas + "Mais" (folha inferior). Sair da conta foi para o menu do avatar no cabeçalho.
6. O gerador do tema escuro e seu teste foram removidos; `tests/theme-tokens.test.mjs` passa a garantir contraste AA dos pares texto/fundo nos dois temas.

## Consequências
- Estilos novos usam classes e tokens; cores soltas em componentes devem ser evitadas.
- Itens de grid/flex com texto truncado precisam de `min-w-0`; caso contrário, o celular amplia a viewport e a barra inferior sai da tela. `tests/e2e/layout.spec.ts` cobre isso em 360 e 412 px.
- Dependências novas: `tailwindcss`, `@tailwindcss/vite` (dev), `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- O tamanho do CSS final é ~50 kB (≈10 kB gzip).
