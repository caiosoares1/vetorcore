---
name: manage-catalog-records
description: "Usar ao adicionar, editar ou arquivar campos, formulários ou regras de produtos, clientes e fornecedores no Vetorcore. Abrange validação de cadastros e sincronização com Supabase sem mudar o fluxo de estoque."
---

# Cadastros de produtos, clientes e fornecedores

## Ler antes de alterar
1. Ler `AGENTS.md`, `docs/architecture.md` e `docs/glossary.md`.
2. Inspecionar `src/App.tsx` (consultas e filtros), `src/components/RecordEditor.tsx` (formularios/drawer), `src/lib/domain.ts` (validações).
3. Para persistência, verificar `supabase/migrations/0001_schema.sql` e `supabase/schema_snapshot.sql`. Se exigir coluna nova, seguir `change-supabase-schema`.

## Passos
1. Identificar o cadastro: `products`, `customers` ou `suppliers`; confirmar campos reais da tabela e tipos TypeScript em `RecordEditor.tsx`.
2. Para cadastro/edição, seguir chamadas existentes `supabase.from(table).insert(...)` ou `.update(...).eq(...).select('id').single()`; não adicionar endpoint HTTP fictício.
3. Colocar normalização/validação reutilizável em `src/lib/domain.ts` (`productPayload` ou `partyPayload`). Usar `errorMessage` para resposta de erro de API.
4. Se alterar dados exibidos, ajustar as seleções e mapeamentos em `App.tsx`. Manter o filtro `archived_at`, as ações de arquivar/restaurar e os indicadores que ignoram arquivados.
5. Manter formulários em `RecordEditor` e a apresentação via `Sheet` (`src/components/ui/overlays.tsx`): drawer no desktop, tela cheia no mobile.
6. Atualizar casos de caminho feliz, validação e erro em `tests/domain.test.mjs`, `tests/e2e/full-flow.spec.ts` e, se necessário, `tests/e2e/support/mockSupabase.ts`.
7. Executar `npm run test:coverage`, `npm run build` e `npm run test:e2e`; registrar limitações reais.

## Não fazer
- Não incrementar/decrementar `products.qty` em `update` de cadastro; estoque segue RPC `record_stock_movement`.
- Não trocar arquivamento reversível por exclusão física sem decisão explícita.
- Não tratar `src/data.ts` (demo anterior) como fonte de produção.
- Não inserir `service_role` no frontend nem fazer escrita no banco remoto por conta própria.

## Exemplos de referência
- `src/components/RecordEditor.tsx`
- `src/lib/domain.ts`
- `src/App.tsx`
- `docs/decisions/0004-soft-archive.md`
