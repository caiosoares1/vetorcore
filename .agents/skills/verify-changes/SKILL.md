---
name: verify-changes
description: "Usar para validar alterações, adicionar testes de domínio ou Playwright, investigar regressões no CI e preparar uma entrega do Vetorcore com evidências reais de cobertura e limitações."
---

# Verificar mudanças no Vetorcore

## Inspecionar
1. Ler `AGENTS.md` e `TESTING.md`.
2. Conferir `package.json`, `.github/workflows/ci.yml` e `playwright.config.ts` antes de declarar comando ou cobertura.
3. Mapear superfícies afetadas (cadastros, auth, estoque, comércio, SQL) e distinguir teste unitário, mock, banco real e dispositivo físico.

## Sequência real
1. Validar funções puras com `npm run test:coverage` (arquivos `tests/domain.test.mjs`, `tests/quote-math.test.mjs`).
2. Para teste unitário isolado: `node --experimental-strip-types --test tests/domain.test.mjs`.
3. Executar `npm run build` (inclui `tsc -b`; não existe comando npm próprio `typecheck`).
4. Instalar o navegador, se necessário: `npx playwright install chromium`.
5. Rodar `npm run test:e2e` para desktop/mobile; para um arquivo: `npx playwright test tests/e2e/full-flow.spec.ts`.
6. Testar caminho feliz, validação, API indisponível/erro e não autorização. Mocks do banco pertencem a `tests/e2e/support/mockSupabase.ts`; não usar tokens/dados reais.
7. Se o pipeline falhar, olhar logs e artefatos `playwright-failures` (traces por até 7 dias); corrigir produto ou teste conforme evidências, nunca silenciar falha.
8. Relatar quais checagens passaram, quais não rodaram e limites de inferência.

## Restrições de interpretação
- Os percentuais de `test:coverage` só cobrem `src/lib/*.ts`, não todo o frontend ou SQL.
- Playwright intercepta Supabase em `https://test.supabase.co` e não prova operação real de produção.
- Verificação SQL real exige ambiente isolado e autorização; não rodar comandos destrutivos no banco da empresa.
- Não há ESLint, Prettier, lockfile, `npm run lint`, `npm run format` ou `npm run check` versionados. Sugerir instalação à parte, sem inventar comandos.
- Arquivos `test-results/`, `playwright-report/`, `dist/` e `node_modules/` são saídas, não fonte.

## Exemplos
- `tests/domain.test.mjs`
- `tests/e2e/full-flow.spec.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
