# Guia de agentes — Vetorcore

## Projeto
Vetor Hub é uma PWA de gestão comercial e de estoque da Vetor Embalagens, feita em React + TypeScript + Vite.
O frontend chama Supabase Auth/PostgreSQL diretamente; operações críticas usam RPCs PostgreSQL. Deploy: Vercel via `main`.

## Comandos verificados
Requer Node.js 22+ (README e CI). Gerenciador: npm; o repositório não contém lockfile versionado.

| Objetivo | Comando |
| --- | --- |
| Instalar | `npm install` |
| Desenvolver | `npm run dev` |
| Build (inclui TypeScript) | `npm run build` |
| Conferir tipos sem build | `npx tsc -b` (etapa `tsc -b` do script build; não há script `typecheck`) |
| Preview | `npm run preview` |
| Todos os unitários | `npm run test` |
| Unitários com cobertura e limites | `npm run test:coverage` |
| Um arquivo unitário | `node --experimental-strip-types --test tests/domain.test.mjs` |
| Instalar Chromium para testes | `npx playwright install chromium` |
| Todos os testes de navegador | `npm run test:e2e` |
| Um arquivo E2E | `npx playwright test tests/e2e/full-flow.spec.ts` |
| Apenas mobile | `npx playwright test tests/e2e/full-flow.spec.ts --project=mobile` |
| Lint / formatação | Não há scripts nem configuração existente; não inventar comandos. |

O CI em `.github/workflows/ci.yml` roda `npm install --no-audit --no-fund`, cobertura, build e Playwright.

## Mapa
- `src/main.tsx`: React root, estilos, atualização do service worker.
- `src/App.tsx`: navegação via estado (sem React Router), dashboard, cadastros e estoque.
- `src/AuthGate.tsx`: Supabase Auth e verificação de `app_members`.
- `src/components/RecordEditor.tsx`: formulários de produto, cliente, fornecedor e movimentação.
- `src/components/Shell.tsx`: barra lateral agrupada, cabeçalho com menu da conta, navegação inferior mobile (4 telas + "Mais").
- `src/components/Dashboard.tsx`, `src/components/Records.tsx`: início e linhas de listas (produto, pessoa, histórico).
- `src/components/ui/`: componentes no padrão shadcn/ui (Tailwind + Radix): `button`, `form` (Field, Input, NativeSelect, MoneyInput), `display` (Card, Badge, Segmented, EmptyState, Skeleton), `overlays` (Sheet, ConfirmDialog, DropdownMenu), `toast`.
- `src/components/CommercePages.tsx`: orçamentos, pedidos, exportação PDF.
- `src/lib/domain.ts`: validações e regras puras; `quoteMath.ts`: valores em centavos; `supabase.ts`: cliente.
- `src/index.css`: Tailwind v4 + tokens de cor claro/escuro (logo: índigo `#363890`, laranja `#ff862b`). Estilize com classes Tailwind e tokens (`bg-card`, `text-muted-foreground`, `text-brand`…), nunca cores soltas. `src/theme.ts` + script em `index.html` definem `html[data-theme]`.
- `supabase/migrations/`: estrutura inicial; `supabase/schema_snapshot.sql`: snapshot de conciliação (não é migration incremental).
- `tests/*.test.mjs`: unitários; `tests/e2e/`: Playwright; `support/mockSupabase.ts`: API simulada.
- `vite.config.ts`, `vercel.json`, `playwright.config.ts`, `tsconfig.json`: configuração.
- `src/data.ts`: modelos/dados demonstrativos antigos; aparente legado — não usar como fonte do estado atual sem verificar.

## Convenções de domínio e integração
- Valores monetários no banco são inteiros `*_cents`. Converter/validar com `src/lib/quoteMath.ts` e `src/lib/domain.ts`; não calcular totais em float para persistência.
- Cadastros usam `supabase.from(...)`; estoque e orçamentos/pedidos críticos usam `supabase.rpc(...)`.
- Quantidade de produtos é modificada via `record_stock_movement`; preservar registro de histórico e checagem de saldo negativo.
- Acesso a dados depende de Supabase Auth + associação a `public.app_members` + RLS, e não só da tela de login.
- Registros são arquivados por `archived_at`, não eliminados do histórico; itens arquivados não participam de novas movimentações/propostas.
- Pedido aprovado/concluído NÃO movimenta estoque automaticamente. A saída é registrada à parte.
- Formulários responsivos usam `Sheet` de `src/components/ui/overlays.tsx` (drawer desktop; tela cheia mobile), `Field` com `id`/rótulo e `FormError` para erros; confirmações usam `ConfirmDialog` (role `alertdialog`).
- Selects continuam nativos (`NativeSelect`): melhor no celular e compatíveis com os testes (`selectOption`).
- Nada pode alargar a página no celular: itens de grid/flex com texto truncado precisam de `min-w-0` (`tests/e2e/layout.spec.ts` verifica 360 e 412 px).
- Novas regras puras: testar com `node:test`; novas jornadas: Playwright desktop/mobile, usando mocks sem dados reais.

## Nunca faça
- Não abrir, imprimir, versionar ou expor valores de `.env`, `.env.local`, tokens, senhas ou chave `service_role`; nunca enviar segredos para `VITE_*`.
- Não aplicar `supabase/schema_snapshot.sql` cegamente; foi extraído do banco remoto, não é histórico incremental reproduzível.
- Não alterar RLS, `SECURITY DEFINER`, privilégios ou executar SQL em produção sem revisar contexto, permissões e rollback.
- Não atualizar `products.qty` diretamente, nem registrar movimentação sem histórico.
- Não reativar a demo/localStorage de `src/data.ts` como fonte de dados de produção.
- Não tratar Playwright com Supabase simulado como teste real de banco ou de segurança.
- Não editar/commitar `dist/`, `node_modules/` nem artefatos gerados. `test-results/` e `playwright-report/` são artefatos de testes, não código.
- Não presumir que Vercel Hobby autoriza uso comercial: o README alerta sobre a restrição.

## Definição de pronto
1. Conferir regras afetadas em `docs/architecture.md`, `docs/glossary.md` e ADRs relevantes.
2. Para mudanças de regras, executar `npm run test:coverage` e atualizar casos limite.
3. Executar `npm run build` e, se mexer na UI, `npm run test:e2e` (instalar Chromium quando necessário).
4. Conferir desktop e mobile, estados de erro e impacto em RLS/RPC; reportar o que não foi possível testar.
5. Não declarar integração real validada com base apenas nos mocks.

## Leitura dirigida
- Fluxos, dados e integrações: [docs/architecture.md](docs/architecture.md).
- Vocabulário: [docs/glossary.md](docs/glossary.md).
- Decisões: [docs/decisions/](docs/decisions/).
- Estratégia e limites de testes: [TESTING.md](TESTING.md).
- Procedimentos recorrentes: [.agents/skills/](.agents/skills/).
